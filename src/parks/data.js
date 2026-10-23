import { polygons, mapGeometry, geometryDistance } from '../spatial.js';
export function validateSnapshot(data) {
  if (data?.type !== 'FeatureCollection' || data.metadata?.schemaVersion !== 1 || !data.metadata.version || !data.metadata.osmBase || !data.features?.length) throw new Error('公園輪廓快照格式錯誤');
  const ids = new Set();
  for (const f of data.features) {
    if (!/^(way|relation)[/][0-9]+$/.test(f.id) || ids.has(f.id) || !Array.isArray(f.properties?.names) || !Number.isInteger(f.properties.osmVersion) || !f.properties.osmTimestamp) throw new Error('Invalid OSM identity');
    ids.add(f.id);
    const ps = polygons(f.geometry);
    if (!ps.length) throw new Error('Missing polygon');
    for (const p of ps) {
      if (!p.length) throw new Error('Empty polygon');
      for (const r of p) {
        if (r.length < 4 || r[0][0] !== r.at(-1)[0] || r[0][1] !== r.at(-1)[1] || r.some(c => c.length !== 2 || !c.every(Number.isFinite) || c[0]<120 || c[0]>123 || c[1]<24 || c[1]>26)) throw new Error('Invalid ring');
      }
    }
  }
  return data;
}
export function createParkLoader({baseUrl,fetcher = fetch}) {
  let pending;
  return () => {
    if (!pending) pending = (async () => {
      const response = await fetcher(baseUrl + 'data/park-boundaries-osm.geojson', {signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return validateSnapshot(await response.json());
    })().catch(error => { pending = undefined; throw error; });
    return pending;
  };
}
export const normalizeParkName = name => String(name ?? "").normalize("NFKC").replaceAll("臺","台").replace(/[ ・·]/gu,"");
const metric = ([lng,lat]) => [lng * 100900, lat * 111200];
export function matchPark(park, features) {
  const name = normalizeParkName(park.properties.pm_name), point = metric(park.geometry.coordinates);
  const candidates = features.flatMap(f => {
    const distance = geometryDistance(point,mapGeometry(f.geometry,metric));
    const sameName = name && f.properties.names.some(n => normalizeParkName(n) === name);
    // No fuzzy name substitutions, no nearest-only automatic matches.
    if (!(sameName && distance <= 250) && distance !== 0) return [];
    return [{feature:f,distance:Math.round(distance),reason:sameName ? '同名且距輪廓不超過 250 公尺' : '位置落於輪廓內，但名稱不一致',sameName}];
  }).sort((a,b) => a.distance-b.distance || a.feature.id.localeCompare(b.feature.id));
  return {status:candidates.length === 1 && candidates[0].sameName ? 'matched' : candidates.length ? 'ambiguous' : 'unmatched',candidates};
}
export function parkKey(park) { return JSON.stringify([park.properties.SeqNo,park.properties.pm_name,park.geometry.coordinates]); }
export const REVIEW_KEY = 'trees.park-boundary-review.v1';
export function createReviews(storage) {
  let records = {};
  try { const data = JSON.parse(storage.getItem(REVIEW_KEY)); if (data?.schemaVersion === 1 && data.records && typeof data.records === 'object' && !Array.isArray(data.records)) records = data.records; } catch { /* unavailable/corrupt storage is reported on write */ }
  const key = (park,snapshot,candidate) => JSON.stringify([parkKey(park),snapshot.metadata.version,candidate.id,candidate.properties.osmVersion]);
  function persist(next) { storage.setItem(REVIEW_KEY,JSON.stringify({schemaVersion:1,records:next})); records = next; }
  return {
    get(park,snapshot,candidate) { const r = records[key(park,snapshot,candidate)]; return ['confirmed','rejected'].includes(r?.decision) ? r : null; },
    set(park,snapshot,candidate,decision) {
      if (!['confirmed','rejected'].includes(decision) || !snapshot.features.some(f => f.id === candidate.id && f.properties.osmVersion === candidate.properties.osmVersion)) throw new Error('Invalid review');
      persist({...records,[key(park,snapshot,candidate)]:{parkKey:parkKey(park),parkName:park.properties.pm_name,snapshot:snapshot.metadata.version,osmId:candidate.id,osmVersion:candidate.properties.osmVersion,decision,reviewedAt:new Date().toISOString()}});
    },
    reset() { storage.removeItem(REVIEW_KEY); records = {}; },
    export() { return {schemaVersion:1,scope:'browser-local-only; not official or public verification',records:{...records}}; }
  };
}
