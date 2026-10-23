// Per-configuration results survive viewport changes. In-flight indices are deduplicated.
export class AnalysisCache {
  constructor(limit = 4) { this.limit = limit; this.configs = new Map(); }
  get(key) {
    let cache = this.configs.get(key);
    if (!cache) cache = { rows: new Map(), pending: new Set(), error: null };
    this.configs.delete(key); this.configs.set(key, cache);
    for (const [oldKey, oldCache] of this.configs) {
      if (this.configs.size <= this.limit) break;
      if (oldKey !== key && !oldCache.pending.size) this.configs.delete(oldKey);
    }
    return cache;
  }
  request(key, indices) {
    const cache = this.get(key), missing = [];
    for (const i of indices) {
      if (cache.rows.has(i) || cache.pending.has(i)) continue;
      cache.pending.add(i); missing.push(i);
    }
    return missing;
  }
  complete(key, indices, rows, error) {
    const cache = this.configs.get(key);
    if (!cache) return;
    indices.forEach(i => cache.pending.delete(i));
    if (error) { cache.error = error; return; }
    for (const row of rows) cache.rows.set(row.index, row);
  }
  failAll(message) { for (const cache of this.configs.values()) { cache.pending.clear(); cache.error = message; } }
  retry() { for (const cache of this.configs.values()) cache.error = null; }
}
