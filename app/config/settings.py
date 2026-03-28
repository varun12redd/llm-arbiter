import os
import logging
from dotenv import load_dotenv

load_dotenv()

def setup_logging():

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )

setup_logging()


class Settings:

    # API Keys
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
    CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY")

    # Execution
    REQUEST_TIMEOUT = 30
    RETRY_ATTEMPTS = 2

    # Arbiter
    SIMILARITY_THRESHOLD = 0.75

    # Cache
    CACHE_TTL = 3600
    CACHE_MAX_SIZE = 500


settings = Settings()