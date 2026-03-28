from collections import OrderedDict


class EmbeddingCache:

    def __init__(self, max_size=500):
        self.cache = OrderedDict()
        self.max_size = max_size

    def get(self, key):
        return self.cache.get(key)

    def set(self, key, value):

        if key in self.cache:
            self.cache.move_to_end(key)

        self.cache[key] = value

        if len(self.cache) > self.max_size:
            self.cache.popitem(last=False)