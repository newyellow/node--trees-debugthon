import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { LAYERS, sha256, verifySourceBytes, createAssigner } from '../scripts/prepare-village-trees.mjs';
const root = new URL('../public/data/', import.meta.url);
const read = p => readFile(new URL(p, root));
const json = async p => JSON.parse(await read(p));

test('meter projection: holes, multipolygons, boundaries, overlap and original-order ties', () => {
  const ring = (a,b,c,d) => [[a,b],[c,b],[c,d],[a,d],[a,b]];
  const outer = ring(121,25,121.02,25.02), hole = ring(121.005,25.005,121.015,25.015);
  const a = { bbox:[121,25,121.02,25.02], geometry:{type:'Polygon',coordinates:[outer,hole]} };
  const b = { bbox:[121,25,121.04,25.04], geometry:{type:'MultiPolygon',coordinates:[[outer],[ring(121.03,25.03,121.04,25.04)]]} };
  const assign = createAssigner([a,b]);
  assert.equal(assign([121.002,25.002]),0);
  assert.equal(assign([121.01,25.01]),1);
  assert.equal(createAssigner([a])([121.01,25.01]),-1);
  assert.equal(assign([121,25]),0); // exact outer boundary vertex
  assert.equal(assign([121.005,25.005]),0); // exact hole boundary vertex
  assert.equal(assign([121.035,25.035]),1);
  assert.equal(assign([122,26]),-1);
  assert.equal(createAssigner([b,a])([121.01,25.01]),0);
  assert.throws(() => assign([NaN,25]), /coordinate/);
});

test('same-length source reorder fails closed before positional membership can be used', async () => {
  const game = await json('village-game.json');
  for (const id of LAYERS) {
    const file = id + '.geojson', bytes = await read(file), data = JSON.parse(bytes);
    verifySourceBytes(file,bytes,game.inputHashes[file]);
    const length = data.features.length;
    [data.features[0],data.features[1]] = [data.features[1],data.features[0]];
    assert.equal(data.features.length,length);
    assert.throws(() => verifySourceBytes(file,Buffer.from(JSON.stringify(data)),game.inputHashes[file]), /byte hash mismatch/);
  }
});

test('tracked shards conserve every original feature, stable identity and recomputed spatial membership', async () => {
  const m = await json('village-trees/manifest.json'), game = await json('village-game.json'), regions = await json('regions.json');
  assert.equal(m.schemaVersion,1); assert.equal(m.treeSnapshot,game.treeSnapshot);
  assert.equal(Object.keys(m.villages).length,456);
  assert.equal(m.total,162369); assert.equal(m.assigned,162321); assert.equal(m.unmatched.count,48);
  assert.deepEqual(m.audit,game.treeAudit);
  for (const [file,hash] of Object.entries(m.sourceHashes)) assert.equal(sha256(await read(file)),hash);
  for (const [file,hash] of Object.entries(game.inputHashes)) assert.equal(m.sourceHashes[file],hash);
  assert.deepEqual(m.layers.map(l=>l.id),LAYERS);
  for (const l of m.layers) { assert.ok(l.source.startsWith('https://')); assert.ok(l.licenseUrl.startsWith('https://')); }
  const sources = Object.fromEntries(await Promise.all(LAYERS.map(async id=>[id,(await json(id+'.geojson')).features])));
  const assign = createAssigner(regions.features), seen = new Set(), expectedMapping = new Map();
  const entries = [...Object.values(m.villages),m.unmatched];
  let total = 0;
  for (const entry of entries) {
    const bytes = await read('village-trees/' + entry.file);
    assert.equal(sha256(bytes),entry.sha256); assert.equal(bytes.length,entry.bytes);
    const shard = JSON.parse(bytes), villageId = entry.id ?? null;
    assert.equal(shard.schemaVersion,1); assert.equal(shard.villageId,villageId); assert.equal(shard.treeSnapshot,m.treeSnapshot);
    assert.equal(shard.records.length,entry.count);
    const counts = Object.fromEntries(LAYERS.map(id=>[id,0]));
    for (const record of shard.records) {
      const { layerId, treeId, sourceIndex, feature } = record;
      assert.ok(LAYERS.includes(layerId));
      const key = JSON.stringify([layerId,treeId]); assert.equal(seen.has(key),false); seen.add(key);
      assert.equal(treeId,feature.properties.TreeID);
      assert.deepEqual(feature,sources[layerId][sourceIndex]); // ALL attributes, bbox, geometry, types, nulls
      const i = assign(feature.geometry.coordinates);
      assert.equal(i,regions.membership[layerId][sourceIndex]);
      assert.equal(villageId,i<0?null:regions.features[i].properties.id);
      expectedMapping.set(key,{layerId,TreeID:treeId,villageId,sourceIndex});
      counts[layerId]++; total++;
    }
    if (villageId !== null) {
      assert.deepEqual(counts,entry.byLayer);
      const original = game.villages.find(v=>v.id===villageId);
      assert.equal(entry.count,original.trees); assert.equal(entry.name,original.name); assert.equal(entry.district,original.district);
    }
  }
  assert.equal(total,162369); assert.equal(seen.size,162369);
  for (const id of LAYERS) for (const f of sources[id]) assert.ok(seen.has(JSON.stringify([id,f.properties.TreeID])));
  const mb = await read('village-trees/'+m.mapping.file);
  assert.equal(sha256(mb),m.mapping.sha256); assert.equal(mb.length,m.mapping.bytes);
  const mapping = JSON.parse(mb); assert.equal(mapping.records.length,m.mapping.count);
  assert.deepEqual(mapping.identity,['layerId','TreeID']);
  const mappingSeen = new Set();
  let offset = 0;
  for (const layerId of LAYERS) for (const [sourceIndex,f] of sources[layerId].entries()) {
    const record = mapping.records[offset++], key=JSON.stringify([layerId,f.properties.TreeID]);
    assert.deepEqual(record,expectedMapping.get(key)); assert.equal(record.sourceIndex,sourceIndex);
    assert.equal(mappingSeen.has(key),false); mappingSeen.add(key);
  }
  assert.equal((await readdir(new URL('village-trees/villages/',root))).length,456);
  assert.deepEqual((await readdir(new URL('village-trees/',root))).sort(),['manifest.json','mapping.json','unmatched.json','villages']);
});
