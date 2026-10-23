// Exact original labels only. These are dataset-label groups, not taxonomic determinations.
export const SOUTH_LABELS = Object.freeze(['大王椰子', '可可椰子', '鳳凰木']);
export const LAYERS = Object.freeze(['street-trees', 'park-trees']);
export function validPoint(f) {
  const c = f?.geometry?.coordinates;
  return f?.geometry?.type === 'Point' && Array.isArray(c) && c.length === 2 && c.every(Number.isFinite) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
}
export function distanceMeters(a, b) {
  const rad = n => n * Math.PI / 180;
  const h = Math.sin(rad(b[1]-a[1])/2)**2 + Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(rad(b[0]-a[0])/2)**2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}
export function youthAnchor(parks) {
  const matches = parks.features.filter(f => f.properties?.pm_name === '青年公園' && f.properties?.pm_regions === '萬華區' && validPoint(f));
  if (matches.length !== 1) throw new Error('青年公園參考點不唯一或缺漏；無法計算鄰近範圍。');
  return matches[0];
}
export function eligibleReason(demo, layer, f, anchor) {
  if (!LAYERS.includes(layer) || !validPoint(f) || typeof f.properties?.TreeID !== 'string' || !f.properties.TreeID.trim()) return null;
  const p = f.properties;
  if (demo === 'south') return SOUTH_LABELS.includes(p.TreeType) ? 'TreeType 精確符合：' + p.TreeType : null;
  if (demo !== 'mango' || p.TreeType !== '芒果') return null;
  if (layer === 'park-trees' && p.ParkName === '青年公園' && p.Dist === '萬華區') return 'ParkName＝青年公園；Dist＝萬華區；TreeType＝芒果';
  if (layer === 'street-trees' && p.Region === '中華路二段' && ['萬華區','中正區'].includes(p.Dist) && anchor && validPoint(anchor)) {
    const distance = distanceMeters(anchor.geometry.coordinates, f.geometry.coordinates);
    if (distance <= 1000) return 'Region＝中華路二段；青年公園資料參考點直線距離 ' + Math.round(distance) + ' 公尺（≤1000 公尺）';
  }
  return null;
}
export function selectRecords(demo, collections, parks) {
  const anchor = demo === 'mango' ? youthAnchor(parks) : null;
  const records = [], ids = new Set();
  for (const layer of LAYERS) {
    const collection = collections[layer];
    if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) throw new Error('樹木資料格式不支援：' + layer);
    for (const [index, feature] of collection.features.entries()) {
      const reason = eligibleReason(demo, layer, feature, anchor);
      if (!reason) continue;
      const key = layer + ':' + feature.properties.TreeID;
      if (ids.has(key)) throw new Error('候選資料 TreeID 重複，無法安全選取：' + key);
      ids.add(key); records.push({key, layer, index, feature, reason});
    }
  }
  return {records, anchor};
}
export async function fetchCollection(url, fetcher = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetcher(url, {signal:controller.signal});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('非 GeoJSON FeatureCollection');
    return data;
  } finally { clearTimeout(timer); }
}
