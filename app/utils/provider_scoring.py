def calculate_provider_score(metrics):

    success = metrics["success"]
    fail = metrics["fail"]
    latency = metrics["avg_latency"]

    total = success + fail

    if total == 0:
        return 0.5

    accuracy = success / total

    # latency penalty
    latency_penalty = min(latency / 10, 1)

    score = (
        0.6 * accuracy +
        0.3 * (1 - latency_penalty) +
        0.1
    )

    return round(score, 3)