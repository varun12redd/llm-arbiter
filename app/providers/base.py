import time
import asyncio
from typing import Dict
from app.utils.normalizer import normalize_text


class BaseProvider:

    timeout = 10

    async def run(self, prompt: str) -> Dict:

        start = time.time()

        try:

            result = await asyncio.wait_for(
                self._call(prompt),
                timeout=self.timeout
            )

            output = normalize_text(result)

            latency = time.time() - start

            return {
                "provider": self.__class__.__name__,
                "status": "ok",
                "output": output,
                "latency": latency,
                "error": None
            }

        except Exception as e:

            latency = time.time() - start

            return {
                "provider": self.__class__.__name__,
                "status": "error",
                "output": None,
                "latency": latency,
                "error": str(e)
            }

    async def _call(self, prompt: str):
        raise NotImplementedError