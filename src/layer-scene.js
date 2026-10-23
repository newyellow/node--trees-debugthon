// Keep Leaflet objects alive between frames; update the membership of the scene.
export class LayerScene {
  constructor(group) { this.group = group; this.entries = new Map(); this.scope = null; }
  begin(scope) {
    this.stats = { added: 0, removed: 0, reused: 0, styled: 0 };
    if (this.scope !== scope) {
      for (const entry of this.entries.values()) this.group.removeLayer(entry.layer);
      this.stats.removed = this.entries.size; this.entries.clear(); this.scope = scope;
    }
    this.seen = new Set();
  }
  use(key, version, create, styleKey = '', style) {
    this.seen.add(key);
    let entry = this.entries.get(key);
    if (entry && entry.version !== version) {
      this.group.removeLayer(entry.layer); this.entries.delete(key); this.stats.removed++; entry = null;
    }
    if (!entry) {
      entry = { layer: create(), version, styleKey };
      this.entries.set(key, entry); this.group.addLayer(entry.layer); this.stats.added++;
    } else {
      this.stats.reused++;
      if (entry.styleKey !== styleKey) { style?.(entry.layer); entry.styleKey = styleKey; this.stats.styled++; }
    }
    return entry.layer;
  }
  finish() {
    for (const [key, entry] of this.entries) {
      if (!this.seen.has(key)) { this.group.removeLayer(entry.layer); this.entries.delete(key); this.stats.removed++; }
    }
    return { ...this.stats, total: this.entries.size };
  }
}
