import google.generativeai as genai
import os
import json
import re


class JudgeProvider:

    def __init__(self):

        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise ValueError("GEMINI_API_KEY not set for Judge")

        genai.configure(api_key=api_key)

        self.model = genai.GenerativeModel("gemini-2.5-flash")

    # =====================================================
    # MAIN JUDGE
    # =====================================================

    def evaluate(self, question: str, answers: list[str]) -> dict:

        formatted_answers = "\n\n".join(
            [f"Answer {i+1}:\n{a}" for i, a in enumerate(answers)]
        )

        prompt = f"""
You are an expert evaluator.

User Question:
{question}

Candidate Answers:
{formatted_answers}

Instructions:

1. Identify the most correct answer.
2. Prefer factual accuracy.
3. Prefer completeness when multiple are correct.

Return ONLY JSON in this format:

{{
 "selected_answer_index": 1,
 "final_answer": "text",
 "confidence": 0.0
}}
"""

        try:

            response = self.model.generate_content(prompt)

            raw_text = response.text.strip()

            # remove markdown JSON blocks if present
            raw_text = re.sub(r"```json|```", "", raw_text).strip()

            result = json.loads(raw_text)

            index = result.get("selected_answer_index", 1)

            # safety check
            if index < 1 or index > len(answers):
                index = 1

            return {
                "selected_answer_index": index,
                "final_answer": result.get("final_answer", answers[index - 1]),
                "confidence": result.get("confidence", 0.6)
            }

        except Exception:

            # fallback if judge fails
            return {
                "selected_answer_index": 1,
                "final_answer": answers[0],
                "confidence": 0.5
            }