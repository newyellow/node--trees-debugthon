import RBush from 'rbush';
import { matches } from './explorer.js';
import { toMeters } from './density.js';
import { mapGeometry, metricBounds, geometryDistance, perimeterSamples } from './spatial.js';

export function aggregateRegions(regions, datasets, level, { district = '', query = '' } = {}) {
  const boundaries = level === 'district' ? regions.districts : regions.features;
  const rows = boundaries.filter(f => !district || f.properties.district === district).map(feature => ({ feature, count: 0, byLayer: {} }));
  const byId = new Map(rows.map(row => [row.feature.properties.id, row]));
  let unmatched = 0;
  for (const { id, features } of datasets) {
    const membership = regions.membership[id];
    if (!membership || membership.length !== features.length) throw new Error('行政界歸屬與樹木快照不一致，請更新分析資料。');
    features.forEach((tree, i) => {
      if (!matches(tree, '', query)) return;
      const village = regions.features[membership[i]];
      if (!village) { if (!district || tree.properties._district === district) unmatched++; return; }
      const key = level === 'district' ? village.properties.district : village.properties.id;
      const row = byId.get(key);
      if (row) { row.count++; row.byLayer[id] = (row.byLayer[id] ?? 0) + 1; }
    });
  }
  return { rows: rows.map(row => ({ ...row, density: row.count / (row.feature.properties.area / 10000) })), unmatched };
}

export function treeIndex(datasets) {
  const index = new RBush();
  index.load(datasets.flatMap(({ id, coordinates }) => coordinates.map(c => {
    const [x, y] = toMeters(c); return { minX: x, minY: y, maxX: x, maxY: y, point: [x, y], id };
  })));
  return index;
}
export function prepareSidewalk(feature) {
  const geometry = mapGeometry(feature.geometry, toMeters);
  const length = Number(feature.properties.SW_LENG_ItemValue);
  return { geometry, bounds: metricBounds(geometry), samples: perimeterSamples(geometry), length: Number.isFinite(length) && length > 0 ? length : null };
}
export function scoreSidewalk(walk, index, { radius = 10, target = 10, coverageGoal = 0.7 } = {}) {
  const [w, s, e, n] = walk.bounds;
  const nearby = index.search({ minX: w - radius, minY: s - radius, maxX: e + radius, maxY: n + radius }).filter(tree => geometryDistance(tree.point, walk.geometry) <= radius);
  let covered = 0, total = 0;
  for (const sample of walk.samples) {
    total += sample.weight;
    if (nearby.some(tree => Math.hypot(tree.point[0] - sample.point[0], tree.point[1] - sample.point[1]) <= radius)) covered += sample.weight;
  }
  const coverage = total ? covered / total : null;
  const per100m = walk.length ? nearby.length / walk.length * 100 : null;
  const score = per100m === null || coverage === null ? null : Math.min(1, per100m / target, coverage / coverageGoal);
  const byLayer = {};
  nearby.forEach(tree => { byLayer[tree.id] = (byLayer[tree.id] ?? 0) + 1; });
  return { count: nearby.length, byLayer, per100m, coverage, score, length: walk.length, samples: walk.samples.length };
}
