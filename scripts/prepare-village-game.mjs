import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import RBush from 'rbush';
import { toMeters } from '../src/density.js';
import { containsPoint, mapGeometry } from '../src/spatial.js';
import { summarizeSpecies } from '../src/species.js';
import { relativeScore, parseCSV, validCoordinate } from '../src/workspaces/02/domain.js';
const root = new URL('../', import.meta.url), sha = b => createHash('sha256').update(b).digest('hex');
const read = p => readFile(new URL(p, root));
const mb = await read('public/data/manifest.json'), rb = await read('public/data/regions.json');
const manifest = JSON.parse(mb), regions = JSON.parse(rb);
if (regions.treeSnapshot !== manifest.fetchedAt || regions.features.length !== 456) throw new Error('Snapshot mismatch');
const inputHashes = { 'manifest.json': sha(mb), 'regions.json': sha(rb) };
const villages = regions.features.map(f => ({ ...f.properties, trees: 0, protected: 0, areaKm2: f.properties.area / 1e6, _trees: [] }));
const index = new RBush(); index.load(regions.features.map((f, i) => ({ minX: f.bbox[0], minY: f.bbox[1], maxX: f.bbox[2], maxY: f.bbox[3], i, geometry: mapGeometry(f.geometry, toMeters) })));
function assign(lng, lat) { const p = toMeters([lng, lat]); return index.search({ minX: lng, maxX: lng, minY: lat, maxY: lat }).filter(v => containsPoint(p, v.geometry)).sort((a,b) => a.i-b.i)[0]?.i ?? -1; }
const treeAudit = {};
for (const id of ['street-trees', 'park-trees']) {
  const bytes = await read('public/data/' + id + '.geojson'); inputHashes[id + '.geojson'] = sha(bytes);
  const data = JSON.parse(bytes), membership = regions.membership[id];
  if (membership.length !== data.features.length) throw new Error('Membership length mismatch');
  let unmatched = 0; const ids = new Set();
  data.features.forEach((f, i) => {
    const key = String(f.properties.TreeID); if (!key || key === 'undefined' || ids.has(key)) throw new Error('Tree ID integrity'); ids.add(key);
    const actual = assign(...f.geometry.coordinates); if (actual !== membership[i]) throw new Error('Positional membership mismatch ' + id + ':' + i);
    if (actual < 0) unmatched++; else { villages[actual].trees++; villages[actual]._trees.push(f); }
  });
  treeAudit[id] = { total: data.features.length, assigned: data.features.length - unmatched, unmatched, spatiallyReverified: data.features.length };
}
const cacheDir = new URL('test-results/village-sources/', root); await mkdir(cacheDir, { recursive: true });
const configs = [
  { key: 'protected', rid: 'a7c2db0d-8b6e-42b2-bdcc-ae69a6797e1d', encoding: 'utf-8', agency: '臺北市文化局', title: '受保護樹木名冊', source: 'https://data.taipei/dataset/detail?id=d9d1140b-c2c3-405f-8dd1-7b87b00f6f53', sourceFileUpdated: '2026-03-23', metadataCoverageEnd: '2023-04-11' },
];
const sources = await Promise.all(configs.map(async c => {
  const url = 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=' + c.rid, file = new URL(c.key + '.csv', cacheDir);
  if (!process.argv.includes('--cached')) execFileSync('curl', ['-fsSL', '--max-time', '90', url, '-o', fileURLToPath(file)]);
  const bytes = await readFile(file), rows = parseCSV(bytes, c.encoding);
  const audit = { raw: rows.length, invalidCoordinates: 0, missingIdentity: 0, duplicates: 0, conflictingDuplicates: 0, uniqueValid: 0, assigned: 0, unmatched: 0, dbhMissingOrInvalid: 0 };
  const seen = new Map();
  for (const r of rows) {
    if (!validCoordinate(r['經度'], r['緯度'])) { audit.invalidCoordinates++; continue; }
    const lng = +r['經度'], lat = +r['緯度'];
    const identity = c.key === 'protected' ? r['樹木編號'].trim() : JSON.stringify([r['地址'].trim(), lng, lat]);
    if (!identity) { audit.missingIdentity++; continue; }
    if (seen.has(identity)) { audit.duplicates++; if (seen.get(identity) !== lng + ',' + lat) audit.conflictingDuplicates++; continue; }
    seen.set(identity, lng + ',' + lat); audit.uniqueValid++;
    if (c.key === 'protected' && (!r['樹胸徑寬度公尺'].trim() || !Number.isFinite(+r['樹胸徑寬度公尺']) || +r['樹胸徑寬度公尺'] <= 0)) audit.dbhMissingOrInvalid++;
    const i = assign(lng, lat); if (i < 0) audit.unmatched++; else { villages[i][c.key]++; audit.assigned++; }
  }
  if (audit.conflictingDuplicates) throw new Error('Conflicting IDs');
  return { ...c, url, sha256: sha(bytes), fetchedAt: process.argv.includes('--cached') ? null : new Date().toISOString(), cached: process.argv.includes('--cached'), license: '政府資料開放授權條款第1版', licenseUrl: 'https://data.gov.tw/license', audit };
}));
for (const v of villages) {
  const s = summarizeSpecies(v._trees); delete v._trees;
  Object.assign(v, { knownNames: s.known, missingNames: s.missingCount, deadStatus: s.statusCount, richness: s.richness, shannon: s.shannon, dominance: s.dominance, treeDensity: v.trees / v.areaKm2, protectedDensity: v.protected / v.areaKm2, native: null, birdsInsects: null });
}
for (const v of villages) v.scores = Object.fromEntries(['treeDensity','protectedDensity','richness'].map(key => [key, relativeScore(v[key], villages.map(r => r[key]))]));
const output = { schemaVersion: 1, preparedAt: new Date().toISOString(), treeSnapshot: manifest.fetchedAt, boundaryFetchedAt: regions.fetchedAt, boundarySource: regions.source, inputHashes, treeAudit, sources, treeSource: { agency: '臺北市政府工務局公園路燈工程管理處', url: 'https://data.gov.tw/dataset/128274', licenseUrl: 'https://data.gov.tw/license' }, reference: { count: villages.length, method: 'zero-anchored-midrank-v1', scope: '全臺北456里；固定快照，不隨行政區篩選重算' }, villages };
const file = new URL('public/data/village-game.json', root); await writeFile(fileURLToPath(file) + '.tmp', JSON.stringify(output)); await rename(fileURLToPath(file) + '.tmp', fileURLToPath(file));
console.log(JSON.stringify({ treeAudit, sources, villages: villages.length }, null, 2));
