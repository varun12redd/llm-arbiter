import re
import numpy as np
from collections import defaultdict
from typing import Dict

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from app.utils.embedding_cache import EmbeddingCache


class Arbiter:

    def __init__(self):

        self.model = SentenceTransformer(
            "all-MiniLM-L6-v2",
            device="cpu"
        )

        self.base_similarity_threshold = 0.75

        self.embedding_cache = EmbeddingCache()

    # ======================================================
    # MAIN DECISION
    # ======================================================

    def decide(self, prompt: str, responses: Dict[str, Dict]) -> Dict:

        valid = {
            name: r["output"]
            for name, r in responses.items()
            if r.get("status") == "ok" and r.get("output")
        }

        total = len(valid)

        if total == 0:
            return self._failure()

        if total == 1:
            provider = list(valid.keys())[0]
            decision = self._single_provider(valid, provider)
            decision["clusters"] = {0: [provider]}
            return decision

        prompt_type = self._classify_prompt(prompt)

        # --------------------------------------------------
        # NUMERIC CASE
        # --------------------------------------------------

        if prompt_type == "numeric":

            numeric_result = self._numeric_majority(valid)

            if numeric_result:

                provider, cluster_size = numeric_result

                decision = self._build_confidence(
                    provider,
                    valid[provider],
                    cluster_size,
                    total,
                    similarity_score=1.0,
                    numeric_consistent=True
                )

                decision["clusters"] = {0: list(valid.keys())}

                return decision

        # --------------------------------------------------
        # SEMANTIC CLUSTERING
        # --------------------------------------------------

        names = list(valid.keys())
        texts = list(valid.values())

        embeddings = self._get_embeddings(texts)

        sim_matrix = cosine_similarity(embeddings)

        clusters = self._build_clusters(
            names,
            sim_matrix
        )

        best_cluster = max(clusters.values(), key=len)

        cluster_size = len(best_cluster)

        representative = best_cluster[0]

        similarity_score = self._cluster_similarity(
            best_cluster,
            names,
            sim_matrix
        )

        if cluster_size > total / 2:

            decision = self._build_confidence(
                representative,
                valid[representative],
                cluster_size,
                total,
                similarity_score,
                numeric_consistent=False
            )

            decision["clusters"] = clusters

            return decision

        best_provider = self._best_semantic_average(
            names,
            sim_matrix
        )

        decision = self._build_confidence(
            best_provider,
            valid[best_provider],
            cluster_size,
            total,
            similarity_score,
            numeric_consistent=False,
            weak=True
        )

        decision["clusters"] = clusters

        return decision

    # ======================================================
    # EMBEDDING OPTIMIZATION
    # ======================================================

    def _get_embeddings(self, texts):

        cached = []
        missing = []

        for text in texts:

            emb = self.embedding_cache.get(text)

            if emb is None:
                missing.append(text)

            cached.append(emb)

        if missing:

            new_embeddings = self.model.encode(missing)

            for text, emb in zip(missing, new_embeddings):
                self.embedding_cache.set(text, emb)

        final_embeddings = []

        for text in texts:
            final_embeddings.append(
                self.embedding_cache.get(text)
            )

        return np.array(final_embeddings)

    # ======================================================
    # CLUSTERING
    # ======================================================

    def _build_clusters(self, names, sim_matrix):

        upper = sim_matrix[np.triu_indices(len(names), k=1)]

        dynamic_threshold = max(
            self.base_similarity_threshold,
            float(np.mean(upper)) - 0.05
        )

        clusters = {}
        assigned = set()
        cluster_id = 0

        for i, name in enumerate(names):

            if name in assigned:
                continue

            clusters[cluster_id] = [name]
            assigned.add(name)

            for j in range(i + 1, len(names)):

                if names[j] in assigned:
                    continue

                if sim_matrix[i][j] >= dynamic_threshold:

                    clusters[cluster_id].append(names[j])
                    assigned.add(names[j])

            cluster_id += 1

        return clusters

    # ======================================================
    # CLUSTER SIMILARITY
    # ======================================================

    def _cluster_similarity(self, cluster, names, sim_matrix):

        if len(cluster) <= 1:
            return 0.0

        idx = [names.index(name) for name in cluster]

        scores = []

        for i in range(len(idx)):
            for j in range(i + 1, len(idx)):
                scores.append(sim_matrix[idx[i]][idx[j]])

        return float(np.mean(scores))

    # ======================================================
    # BEST SEMANTIC PROVIDER
    # ======================================================

    def _best_semantic_average(self, names, sim_matrix):

        avg_scores = {}

        for i, name in enumerate(names):
            avg_scores[name] = float(np.mean(sim_matrix[i]))

        return max(avg_scores, key=avg_scores.get)

    # ======================================================
    # CONFIDENCE
    # ======================================================

    def _build_confidence(
        self,
        provider,
        response,
        cluster_size,
        total,
        similarity_score,
        numeric_consistent,
        weak=False
    ):

        consensus_ratio = cluster_size / total

        numeric_bonus = 0.15 if numeric_consistent else 0

        final_score = (
            0.6 * consensus_ratio +
            0.3 * similarity_score +
            numeric_bonus
        )

        if weak:
            final_score *= 0.8

        if final_score >= 0.92:
            level = "very_high"

        elif final_score >= 0.82:
            level = "high"

        elif final_score >= 0.68:
            level = "moderate"

        else:
            level = "low"

        return {
            "selected_provider": provider,
            "confidence": {
                "certainty_level": level,
                "consensus_ratio": round(consensus_ratio, 3),
                "similarity_score": round(similarity_score, 3),
                "numeric_consistent": numeric_consistent,
                "providers_considered": total,
                "providers_agreed": cluster_size
            },
            "response": response
        }

    # ======================================================
    # HELPERS
    # ======================================================

    def _classify_prompt(self, prompt):

        prompt = prompt.lower()

        if any(op in prompt for op in ["+", "-", "*", "/", "calculate", "solve"]):
            return "numeric"

        if "python" in prompt or "code" in prompt:
            return "code"

        return "general"

    def _extract_strict_number(self, text):

        match = re.search(r"(-?\d+\.?\d*)", text)

        if match:
            return match.group(1)

        return None

    def _numeric_majority(self, outputs):

        number_map = defaultdict(list)

        for name, text in outputs.items():

            num = self._extract_strict_number(text)

            if num:
                number_map[num].append(name)

        if not number_map:
            return None

        best_number, providers = max(number_map.items(), key=lambda x: len(x[1]))

        if len(providers) > len(outputs) / 2:
            return providers[0], len(providers)

        return None

    def _single_provider(self, outputs, provider):

        return {
            "selected_provider": provider,
            "confidence": {
                "certainty_level": "moderate",
                "consensus_ratio": 1.0,
                "similarity_score": 1.0,
                "numeric_consistent": False,
                "providers_considered": 1,
                "providers_agreed": 1
            },
            "response": outputs[provider]
        }

    def _failure(self):

        return {
            "selected_provider": None,
            "confidence": {
                "certainty_level": "none",
                "consensus_ratio": 0,
                "providers_considered": 0,
                "providers_agreed": 0
            },
            "response": "All providers failed."
        }