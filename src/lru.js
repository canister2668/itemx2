/* A small least-recently-used map: a hit moves the entry to the young end,
 * inserting past the limit drops the oldest. */
export function createLru(limit) {
  const map = new Map();
  return {
    get(key) {
      if (!map.has(key)) return undefined;
      const value = map.get(key);
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key, value) {
      map.delete(key);
      map.set(key, value);
      while (map.size > limit) map.delete(map.keys().next().value);
      return value;
    },
    clear: () => map.clear(),
    get size() {
      return map.size;
    }
  };
}
