from dotenv import load_dotenv
load_dotenv()

import logging
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.execution.execution_pool import ExecutionPool
from app.providers.gemini import GeminiProvider
from app.providers.groq import GroqProvider
from app.providers.mistral import MistralProvider
from app.providers.cerebras import CerebrasProvider
from app.providers.judge import JudgeProvider

from app.arbiter.arbiter import Arbiter

from app.utils.validators import validate_prompt, validate_mode
from app.utils.cache import SimpleCache
from app.router.prompt_router import PromptRouter


# ================= LOGGING =================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

logger = logging.getLogger("LLM-Arbiter")

# ================= APP =================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= REQUEST =================
class AskRequest(BaseModel):
    prompt: str
    mode: str = "analysis"


# ================= PROVIDERS =================
providers = {}

def register_provider(name, provider_class):
    try:
        providers[name] = provider_class()
        logger.info(f"{name} initialized successfully")
    except Exception as e:
        logger.error(f"{name} failed to initialize: {e}")


register_provider("GroqProvider", GroqProvider)
register_provider("CerebrasProvider", CerebrasProvider)
register_provider("MistralProvider", MistralProvider)
register_provider("GeminiProvider", GeminiProvider)


# ================= CORE COMPONENTS =================
execution_pool = ExecutionPool(providers)
arbiter = Arbiter()
judge = JudgeProvider()
cache = SimpleCache()
router = PromptRouter()


# ================= MAIN ENDPOINT =================
@app.post("/ask")
async def ask(request: AskRequest):

    request_id = str(uuid.uuid4())
    logger.info(f"[{request_id}] Incoming request")

    try:
        validate_prompt(request.prompt)
        validate_mode(request.mode)

        cache_key = f"{request.prompt}:{request.mode}"

        cached = cache.get(cache_key)
        if cached:
            logger.info(f"[{request_id}] Cache hit")
            return cached

        # ================= PROVIDER SELECTION =================
        selected_providers = router.select_providers(
            request.prompt,
            providers,
            execution_pool.metrics
        )

        execution_pool.providers = selected_providers

        # ================= EXECUTION =================
        responses = await execution_pool.run(
            request.prompt,
            arbiter,
            mode=request.mode
        )

        # ================= ARBITER =================
        decision = arbiter.decide(
            request.prompt,
            responses
        )

        final_answer = decision["response"]

        # ================= VALID OUTPUTS =================
        valid_outputs = [
            r["output"]
            for r in responses.values()
            if r["status"] == "ok" and r["output"]
        ]

        judge_used = False
        judge_result = None

        # ================= JUDGE (ALWAYS WHEN POSSIBLE) =================
        if len(valid_outputs) > 1:
            try:
                logger.info(f"[{request_id}] Running judge...")

                judge_result = judge.evaluate(
                    request.prompt,
                    valid_outputs
                )

                final_answer = judge_result["final_answer"]
                judge_used = True

                logger.info(
                    f"[{request_id}] Judge selected answer index: "
                    f"{judge_result.get('selected_answer_index')}"
                )

            except Exception as e:
                logger.error(f"[{request_id}] Judge failed: {e}")

        # ================= FINAL RESPONSE =================
        result = {
            "prompt": request.prompt,
            "providers": responses,
            "clusters": decision.get("clusters", {}),
            "final_answer": final_answer,
            "selected_provider": decision["selected_provider"],
            "confidence": decision["confidence"],
            "judge_used": judge_used,
            "judge_result": judge_result,
            "metrics": execution_pool.metrics,
            "mode": request.mode
        }

        cache.set(cache_key, result)

        logger.info(f"[{request_id}] Completed successfully")

        return result

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:
        logger.error(f"[{request_id}] Internal error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )


# ================= HEALTH =================
@app.get("/health")
def health():
    return {
        "status": "ok",
        "providers_available": list(providers.keys()),
        "provider_count": len(providers),
        "cache_size": len(cache.store),
        "provider_metrics": execution_pool.metrics
    }