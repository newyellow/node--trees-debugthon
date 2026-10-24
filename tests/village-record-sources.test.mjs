import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decodeSource,validCoordinate,sha256,verifySourceBytes,sourceIdentity,createAssigner,prepareRecords,assertAudit } from '../scripts/prepare-village-records.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root));
const snapshot=JSON.parse(await read('public/data/village-game.json')),regionsBytes=await read('public/data/regions.json'),regions=JSON.parse(regionsBytes),assign=createAssigner(regions);
const metadata=JSON.parse(await read('public/data/village-record-layers.json'));
test('pinned boundaries and standard point manifest',()=>{
  assert.equal(sha256(regionsBytes),snapshot.inputHashes['regions.json']);
  assert.equal(metadata.schemaVersion,1);assert.deepEqual(metadata.layers.map(l=>l.id),['protected-trees','clean-bins']);
  for(const l of metadata.layers){assert.equal(l.kind,'point');assert.match(l.color,/^#[0-9a-f]{6}$/i);assert.equal(l.licenseUrl,'https://data.gov.tw/license');}
});
for(const source of snapshot.sources)test(source.key+' conserves bytes, audit, identities, attributes and WGS84 geometry',async t=>{
  let bytes;try{bytes=await read('test-results/village-sources/'+source.key+'.csv');}catch(error){if(error.code==='ENOENT'){t.skip('Optional original-byte audit requires SHA-pinned ignored CSV cache; published inventory is checked separately');return;}throw error;}verifySourceBytes(bytes,source);
  const rows=decodeSource(bytes,source.key),result=prepareRecords(rows,source.key,assign,regions),layer=metadata.layers.find(l=>l.sourceSha256===source.sha256),published=JSON.parse(await read('public/data/'+layer.file));
  assertAudit(result.audit,source.audit,source.key);assert.deepEqual(published,result.collection);assert.deepEqual(layer.audit,result.audit);
  assert.equal(layer.valid,published.features.length);assert.equal(layer.sourceFetchedAt,source.fetchedAt);assert.equal(layer.fetchedAt,source.fetchedAt);assert.equal(layer.source,source.source);assert.equal(layer.agency,source.agency);
  const originals=new Map();for(const row of rows)if(validCoordinate(row['經度'],row['緯度'])){const id=sourceIdentity(row,source.key);if(id&&!originals.has(id))originals.set(id,row);}
  const ids=new Set();for(const feature of published.features){
    assert.equal(feature.geometry.type,'Point');const [x,y]=feature.geometry.coordinates;assert.ok(validCoordinate(x,y));assert.deepEqual(feature.bbox,[x,y,x,y]);
    assert.ok(x>=published.bbox[0]&&x<=published.bbox[2]&&y>=published.bbox[1]&&y<=published.bbox[3]);
    assert.ok(!ids.has(feature.id));ids.add(feature.id);
    const row=originals.get(sourceIdentity(feature.properties,source.key));assert.ok(row);
    assert.deepEqual(Object.fromEntries(Object.entries(feature.properties).filter(([key])=>!key.startsWith('_'))),row);
    assert.deepEqual(feature.geometry.coordinates,[+row['經度'],+row['緯度']]);assert.ok(feature.properties._name);assert.ok(feature.properties._search.includes(row['地址']));
    if(source.key==='protected'){assert.equal(feature.id,row['樹木編號'].trim());assert.equal(feature.properties._officialId,feature.id);assert.equal(feature.properties._idKind,'official');}
    else{assert.equal(feature.properties._district,row['行政區'].trim());assert.equal(feature.id,'derived:address-coordinates:sha256:'+sha256(sourceIdentity(row,'bins')));assert.equal(feature.properties._derivedId,feature.id);assert.equal(feature.properties._officialId,undefined);}
  }
  assert.equal(result.audit.uniqueValid,source.key==='protected'?3874:658);
  if(source.key==='protected')assert.equal(published.features.filter(f=>!f.properties._district).length,3);
});
test('fatal exact encoding, quoted CSV and source SHA fail closed',()=>{
  assert.throws(()=>decodeSource(Uint8Array.of(255),'protected'));
  assert.throws(()=>decodeSource(Uint8Array.of(129),'bins'));
  assert.deepEqual(decodeSource(Buffer.from('行政區,地址,經度,緯度\r\n士林區,"甲,乙",121.5,25.1'),'protected'),[{'行政區':'士林區','地址':'甲,乙','經度':'121.5','緯度':'25.1'}]);
  assert.throws(()=>verifySourceBytes(Buffer.from('changed'),snapshot.sources[0]),/SOURCE_SHA_MISMATCH/);
  const altered={...snapshot.sources[0],encoding:'big5'};assert.throws(()=>verifySourceBytes(Buffer.from(''),{...altered,sha256:sha256('')}),/SOURCE_ENCODING/);
});
const bin={行政區:'士林區',地址:' 同一地址 ',經度:'121.5',緯度:'25.1',備註:'官方備註'};
const tree={樹木編號:' 001 ',樹種名稱:'榕',樹胸徑寬度公尺:'1.13',地址:'原地址',經度:'121.5',緯度:'25.1'};
test('exact address/coordinates duplicates only; nearby and same-position distinct addresses retained',()=>{
  const rows=[bin,{...bin,地址:'同一地址',經度:'121.5000'},{...bin,經度:'121.5000001'},{...bin,地址:'另一地址'},{...bin,緯度:''},{...bin,經度:'0'}];
  const {collection,audit}=prepareRecords(rows,'bins');assert.equal(collection.features.length,3);
  assertAudit(audit,{raw:6,invalidCoordinates:2,duplicates:1,uniqueValid:3,unmatched:3},'bins');
  assert.equal(collection.features[0].properties.地址,' 同一地址 ');
});
test('official IDs preserve strings and reject conflicting positions; invalid bounds and identity fixtures',()=>{
  const {collection,audit}=prepareRecords([tree,{...tree}, {...tree,樹木編號:' '},{...tree,經度:'NaN'},{...tree,經度:'121.81'}],'protected');
  assert.equal(collection.features[0].id,'001');assert.equal(collection.features[0].properties.樹木編號,' 001 ');
  assertAudit(audit,{raw:5,duplicates:1,missingIdentity:1,invalidCoordinates:2,uniqueValid:1,unmatched:1},'protected');
  assert.throws(()=>prepareRecords([tree,{...tree,經度:'121.6'}],'protected'),/Conflicting official ID/);
  assert.equal(validCoordinate('121.3','24.8'),true);assert.equal(validCoordinate('121.8','25.3'),true);assert.equal(validCoordinate('','25'),false);assert.equal(validCoordinate('121.5','Infinity'),false);
});

for(const source of snapshot.sources)test(source.key+' published inventory validates without optional source cache',async()=>{
 const layer=metadata.layers.find(l=>l.sourceSha256===source.sha256),published=JSON.parse(await read('public/data/'+layer.file));
 assert.deepEqual(layer.audit,source.audit);assert.equal(layer.valid,source.audit.uniqueValid);assert.equal(published.features.length,layer.valid);assert.equal(layer.sourceFetchedAt,source.fetchedAt);
 const ids=new Set();for(const f of published.features){assert.equal(f.geometry.type,'Point');const [x,y]=f.geometry.coordinates;assert.ok(validCoordinate(x,y));assert.deepEqual(f.bbox,[x,y,x,y]);assert.equal(+f.properties['經度'],x);assert.equal(+f.properties['緯度'],y);assert.ok(!ids.has(f.id));ids.add(f.id);if(source.key==='protected')assert.equal(f.id,f.properties['樹木編號'].trim());else assert.equal(f.id,'derived:address-coordinates:sha256:'+sha256(sourceIdentity(f.properties,'bins')));}
});
