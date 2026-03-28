import re


def normalize_text(text: str) -> str:

    if not text:
        return ""

    text = text.strip()

    # remove markdown code blocks
    text = re.sub(r"```.*?```", "", text, flags=re.DOTALL)

    # remove excessive whitespace
    text = re.sub(r"\s+", " ", text)

    # remove leading filler phrases
    text = re.sub(
        r"^(here is|here's|the answer is|answer:)\s*",
        "",
        text,
        flags=re.IGNORECASE
    )

    return text.strip()