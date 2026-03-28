import os
import httpx

from app.providers.base import BaseProvider


class GeminiProvider(BaseProvider):

    async def _call(self, prompt: str):

        api_key = os.getenv("GEMINI_API_KEY")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ]
        }

        async with httpx.AsyncClient(timeout=10) as client:

            r = await client.post(
                url,
                json=payload
            )

            r.raise_for_status()

            data = r.json()

            return data["candidates"][0]["content"]["parts"][0]["text"]