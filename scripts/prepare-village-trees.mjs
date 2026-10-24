import { readFile, writeFile, mkdir, rename, rm, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import RBush from 'rbush';
import { toMeters } from '../src/density.js';
import { containsPoint, mapGeometry } from '../src/spatial.js';
export const LAYERS = ['street-trees', 'park-trees'];
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function verifySourceBytes(file, bytes, expected) {
  if (!expected || sha256(bytes) !== expected) throw new Error('Source byte hash mismatch: ' + file);
}
export function createAssigner(features) {
  const index = new RBush();
  index.load(features.map((f, i) => ({ minX: f.bbox[0], minY: f.bbox[1], maxX: f.bbox[2], maxY: f.bbox[3], i, geometry: mapGeometry(f.geometry, toMeters) })));
  return coordinate => {
    const [lng, lat] = coordinate;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error('Invalid coordinate');
    const p = toMeters([lng, lat]);
    return index.search({ minX: lng, maxX: lng, minY: lat, maxY: lat }).filter(v => containsPoint(p, v.geometry)).sort((a, b) => a.i - b.i)[0]?.i ?? -1;
  };
}
export async function prepare(root = new URL('../', import.meta.url)) {
  const read = file => readFile(new URL('public/data/' + file, root));
  const gameBytes = await read('village-game.json'), game = JSON.parse(gameBytes);
  const sourceHashes = {}, inputs = {};
  for (const file of ['manifest.json', 'regions.json', ...LAYERS.map(id => id + '.geojson')]) {
    const bytes = await read(file);
    verifySourceBytes(file, bytes, game.inputHashes[file]);
    sourceHashes[file] = sha256(bytes); inputs[file] = JSON.parse(bytes);
  }
  sourceHashes['village-game.json'] = sha256(gameBytes);
  const source = inputs['manifest.json'], regions = inputs['regions.json'];
  if (regions.treeSnapshot !== source.fetchedAt || game.treeSnapshot !== source.fetchedAt || regions.features.length !== 456) throw new Error('Snapshot mismatch');
  const assign = createAssigner(regions.features), ids = new Set(), shards = new Map(), villages = {};
  for (const f of regions.features) {
    const { id, district, name } = f.properties;
    if (!/^[0-9]+$/.test(id) || ids.has(id)) throw new Error('Invalid or duplicate village ID');
    ids.add(id);
    villages[id] = { id, district, name, file: 'villages/' + id + '.json', count: 0, sha256: null, byLayer: Object.fromEntries(LAYERS.map(id => [id, 0])) };
    shards.set(id, { schemaVersion: 1, villageId: id, treeSnapshot: source.fetchedAt, records: [] });
  }
  const unmatched = { schemaVersion: 1, villageId: null, treeSnapshot: source.fetchedAt, records: [] };
  const mapping = { schemaVersion: 1, treeSnapshot: source.fetchedAt, identity: ['layerId', 'TreeID'], records: [] }, audit = {};
  for (const layerId of LAYERS) {
    const features = inputs[layerId + '.geojson'].features, membership = regions.membership[layerId], seen = new Set();
    if (membership.length !== features.length) throw new Error('Membership length mismatch');
    let assigned = 0;
    for (const [sourceIndex, feature] of features.entries()) {
      const treeId = feature.properties.TreeID;
      if (typeof treeId !== 'string' || !treeId.trim() || seen.has(treeId)) throw new Error('Missing or duplicate stable TreeID: ' + layerId);
      seen.add(treeId);
      if (feature.geometry?.type !== 'Point') throw new Error('Expected original point geometry');
      const actual = assign(feature.geometry.coordinates);
      if (actual !== membership[sourceIndex]) throw new Error('Spatial membership mismatch: ' + layerId + ':' + treeId);
      const villageId = actual < 0 ? null : regions.features[actual].properties.id;
      const record = { layerId, treeId, sourceIndex, feature };
      (villageId === null ? unmatched : shards.get(villageId)).records.push(record);
      mapping.records.push({ layerId, TreeID: treeId, villageId, sourceIndex });
      if (villageId !== null) { assigned++; villages[villageId].count++; villages[villageId].byLayer[layerId]++; }
    }
    audit[layerId] = { total: features.length, assigned, unmatched: features.length - assigned, spatiallyReverified: features.length };
    if (JSON.stringify(audit[layerId]) !== JSON.stringify(game.treeAudit[layerId])) throw new Error('Tree audit mismatch');
  }
  for (const v of game.villages) if (villages[v.id]?.count !== v.trees) throw new Error('Original village count mismatch: ' + v.id);
  const total = mapping.records.length, assigned = total - unmatched.records.length;
  if (total !== 162369 || assigned !== 162321 || unmatched.records.length !== 48) throw new Error('Conservation mismatch');
  const output = new URL('public/data/village-trees/', root);
  await mkdir(output, { recursive: true });
  const stage = await mkdtemp(new URL('.stage-', output));
  try {
    await mkdir(stage + '/villages');
    const files = [];
    async function save(file, data) {
      const bytes = JSON.stringify(data);
      await writeFile(stage + '/' + file, bytes); files.push(file);
      return { file, count: data.records.length, sha256: sha256(bytes), bytes: Buffer.byteLength(bytes) };
    }
    for (const [id, data] of shards) Object.assign(villages[id], await save(villages[id].file, data));
    const unmatchedInfo = await save('unmatched.json', unmatched), mappingInfo = await save('mapping.json', mapping);
    const manifest = {
      schemaVersion: 1, treeSnapshot: source.fetchedAt, sourceHashes,
      layers: source.layers.filter(l => LAYERS.includes(l.id)).map(l => ({ ...l, sha256: sourceHashes[l.file], licenseUrl: game.treeSource.licenseUrl })),
      boundary: { source: regions.source, download: regions.download, fetchedAt: regions.fetchedAt, sha256: sourceHashes['regions.json'] },
      assignment: { method: 'shared-TWD97-meter-point-in-polygon-v1', boundary: 'included; holes excluded except boundary', tie: 'first original regions.features order', identity: ['layerId', 'TreeID'], sourceIndex: 'provenance only; not identity' },
      audit, total, assigned, villages, unmatched: unmatchedInfo, mapping: mappingInfo
    };
    await writeFile(stage + '/manifest.json', JSON.stringify(manifest));
    await mkdir(new URL('villages/', output), { recursive: true });
    // Stage everything first; atomic per-file rename; manifest is the last commit marker.
    // Readers should verify hashes when refresh and fetch overlap (not a directory transaction).
    for (const file of files) await rename(stage + '/' + file, new URL(file, output));
    await rename(stage + '/manifest.json', new URL('manifest.json', output));
    return manifest;
  } finally { await rm(stage, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const m = await prepare();
  console.log(JSON.stringify({ villages: Object.keys(m.villages).length, total: m.total, assigned: m.assigned, unmatched: m.unmatched.count, mapping: m.mapping.count }));
}
