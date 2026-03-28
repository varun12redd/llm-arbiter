from app.providers.base import BaseProvider
import os
import httpx


class GroqProvider(BaseProvider):

    async def _call(self, prompt: str):

        api_key = os.getenv("GROQ_API_KEY")

        url = "https://api.groq.com/openai/v1/chat/completions"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "llama-3.1-8b-instant",
            "messages": [
                {"role": "user", "content": prompt}
            ]
        }

        async with httpx.AsyncClient() as client:

            r = await client.post(
                url,
                headers=headers,
                json=payload
            )

            r.raise_for_status()

            data = r.json()

            return data["choices"][0]["message"]["content"]