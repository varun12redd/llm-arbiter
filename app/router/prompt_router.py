from app.utils.provider_scoring import calculate_provider_score


class PromptRouter:

    def select_providers(self, prompt, providers, metrics=None):

        if metrics is None:
            return providers

        provider_scores = {}

        for name in providers:

            provider_scores[name] = calculate_provider_score(
                metrics.get(name, {
                    "success": 0,
                    "fail": 0,
                    "avg_latency": 1
                })
            )

        # sort providers by score
        sorted_providers = sorted(
            provider_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )

        # select ALL providers (important for UI comparison)
        selected_names = [name for name, _ in sorted_providers]

        selected = {
            name: providers[name]
            for name in selected_names
        }

        return selected