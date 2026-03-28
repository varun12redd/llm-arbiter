import threading
from collections import defaultdict


class ProviderRegistry:
    def __init__(self):
        self.lock = threading.Lock()
        self.stats = defaultdict(lambda: {
            "calls": 0,
            "success": 0,
            "failures": 0,
            "total_latency": 0.0
        })

    def record(self, provider_name: str, success: bool, latency_ms: float):
        with self.lock:
            data = self.stats[provider_name]
            data["calls"] += 1
            data["total_latency"] += latency_ms

            if success:
                data["success"] += 1
            else:
                data["failures"] += 1

    def get_reliability_score(self, provider_name: str) -> float:
        data = self.stats[provider_name]

        if data["calls"] == 0:
            return 1.0

        success_rate = data["success"] / data["calls"]
        avg_latency = data["total_latency"] / data["calls"]

        latency_penalty = min(avg_latency / 20000, 1.0)

        reliability = success_rate * (1 - 0.3 * latency_penalty)

        return max(0.1, reliability)
