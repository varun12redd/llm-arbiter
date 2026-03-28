import asyncio


class ExecutionPool:

    def __init__(self, providers):

        self.providers = providers

        self.metrics = {
            name: {
                "success": 0,
                "fail": 0,
                "avg_latency": 0
            }
            for name in providers
        }

    # ==========================================================
    # MAIN RUNNER
    # ==========================================================

    async def run(self, prompt, arbiter, mode="parallel"):

        if mode == "sequential":
            return await self._run_sequential(prompt)

        if mode == "analysis":
            return await self._run_all_parallel(prompt)

        return await self._run_parallel(prompt, arbiter)

    # ==========================================================
    # ANALYSIS MODE (RUN ALL PROVIDERS)
    # ==========================================================

    async def _run_all_parallel(self, prompt):

        tasks = {}
        responses = {}

        for name, provider in self.providers.items():

            tasks[name] = asyncio.create_task(provider.run(prompt))

        results = await asyncio.gather(*tasks.values())

        for name, result in zip(tasks.keys(), results):

            responses[name] = result

            self._update_metrics(name, result)

        return responses

    # ==========================================================
    # PARALLEL MODE WITH EARLY CONSENSUS
    # ==========================================================

    async def _run_parallel(self, prompt, arbiter):

        tasks = {}
        responses = {}

        for name, provider in self.providers.items():

            tasks[name] = asyncio.create_task(provider.run(prompt))

        while tasks:

            done, _ = await asyncio.wait(
                tasks.values(),
                return_when=asyncio.FIRST_COMPLETED
            )

            for finished_task in done:

                provider_name = None

                for name, task in tasks.items():
                    if task == finished_task:
                        provider_name = name
                        break

                if provider_name is None:
                    continue

                result = finished_task.result()

                responses[provider_name] = result

                self._update_metrics(provider_name, result)

                del tasks[provider_name]

            if len(responses) >= 2:

                decision = arbiter.decide(prompt, responses)

                confidence = decision["confidence"]["certainty_level"]

                if confidence in {"very_high", "high"}:

                    for remaining_task in tasks.values():
                        remaining_task.cancel()

                    break

        await asyncio.sleep(0)

        return responses

    # ==========================================================
    # SEQUENTIAL MODE
    # ==========================================================

    async def _run_sequential(self, prompt):

        responses = {}

        for name, provider in self.providers.items():

            result = await provider.run(prompt)

            responses[name] = result

            self._update_metrics(name, result)

        return responses

    # ==========================================================
    # METRICS
    # ==========================================================

    def _update_metrics(self, name, result):

        metric = self.metrics[name]

        latency = result.get("latency", 0)

        if result["status"] == "ok":
            metric["success"] += 1
        else:
            metric["fail"] += 1

        total = metric["success"] + metric["fail"]

        metric["avg_latency"] = (
            (metric["avg_latency"] * (total - 1) + latency) / total
        )