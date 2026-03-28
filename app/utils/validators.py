MAX_PROMPT_LENGTH = 2000
VALID_MODES = {"sequential", "parallel", "analysis"}


def validate_prompt(prompt: str):

    if not prompt:
        raise ValueError("Prompt cannot be empty")

    if not isinstance(prompt, str):
        raise ValueError("Prompt must be a string")

    if len(prompt.strip()) == 0:
        raise ValueError("Prompt cannot be blank")

    if len(prompt) > MAX_PROMPT_LENGTH:
        raise ValueError(
            f"Prompt too long. Max allowed length is {MAX_PROMPT_LENGTH}"
        )


def validate_mode(mode: str):

    if mode not in VALID_MODES:
        raise ValueError(
            f"Invalid mode '{mode}'. Valid modes: {VALID_MODES}"
        )