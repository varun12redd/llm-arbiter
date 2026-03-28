import os
import httpx

from app.providers.base import BaseProvider


class MistralProvider(BaseProvider):

    async def _call(self, prompt: str):

        api_key = os.getenv("MISTRAL_API_KEY")

        url = "https://api.mistral.ai/v1/chat/completions"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "mistral-small",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }

        async with httpx.AsyncClient(timeout=10) as client:

            r = await client.post(
                url,
                headers=headers,
                json=payload
            )

            r.raise_for_status()

            data = r.json()

            return data["choices"][0]["message"]["content"]
