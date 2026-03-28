import hashlib
import time


class SimpleCache:

    def __init__(self, ttl_seconds=3600, max_size=500):

        self.ttl = ttl_seconds
        self.max_size = max_size
        self.store = {}

    def _hash(self, prompt: str):

        return hashlib.sha256(prompt.encode()).hexdigest()

    def get(self, prompt: str):

        key = self._hash(prompt)

        if key not in self.store:
            return None

        value, timestamp = self.store[key]

        if time.time() - timestamp > self.ttl:
            del self.store[key]
            return None

        return value

    def set(self, prompt: str, value):

        if len(self.store) >= self.max_size:
            self.store.pop(next(iter(self.store)))

        key = self._hash(prompt)

        self.store[key] = (value, time.time())