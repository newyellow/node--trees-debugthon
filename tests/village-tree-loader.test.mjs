import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source = await readFile(new URL('../src/workspaces/02/village-trees.js',import.meta.url),'utf8');
const pure = source.split(String.fromCharCode(10)).filter(line => !line.startsWith('import ')).join(String.fromCharCode(10));
const {createVillageTreeLoader,validateVillageManifest,validateVillageShard,samePointRecords} = await import('data:text/javascript;base64,'+Buffer.from(pure).toString('base64'));
const snapshot = '2026-10-23T00:00:00Z', hash = 'a'.repeat(64);
const record = i => ({layerId:'street-trees',treeId:String(i),sourceIndex:i,feature:{type:'Feature',properties:{TreeID:String(i),TreeType:'榕樹',Nested:{text:'<script>'},_helper:'kept in raw'},geometry:{type:'Point',coordinates:[121.5,25]}}});
const digest = b => createHash('sha256').update(b).digest('hex');
const deferred = () => {let resolve;const promise = new Promise(r => {resolve=r;});return {resolve,promise};};
function fixture(ids = ['A','B'], count = 2) {
  const files = new Map(), villages = {};
  for (const id of ids) {
    const shard = {schemaVersion:1,villageId:id,treeSnapshot:snapshot,records:Array.from({length:count},(_,i)=>record(i))};
    const bytes = new TextEncoder().encode(JSON.stringify(shard));
    villages[id] = {id,name:id,district:'測試區',file:id+'.json',count,sha256:digest(bytes),byLayer:{'street-trees':count,'park-trees':0}};
    files.set(id+'.json',bytes);
  }
  const manifest = {schemaVersion:1,treeSnapshot:snapshot,sourceHashes:{'street-trees.geojson':hash,'park-trees.geojson':hash},villages};
  files.set('manifest.json',new TextEncoder().encode(JSON.stringify(manifest)));
  const calls = [], gates = new Map(); let failure;
  const fetcher = async url => {const name=url.split('/').pop();calls.push(name);if(gates.has(name))await gates.get(name).promise;if(failure===name)return {ok:false,status:503};const b=files.get(name);return {ok:true,arrayBuffer:async()=>b.slice().buffer};};
  return {files,manifest,calls,gates,fetcher,setFailure:name=>{failure=name;}};
}
test('deduplicated lazy loads preserve cached raw pointers; clear invalidates late completion',async()=>{
  const f=fixture(),states=[],gate=deferred();f.gates.set('A.json',gate);
  const l=createVillageTreeLoader({fetcher:f.fetcher,changed:s=>states.push(s)});
  assert.equal(f.calls.length,0);
  const a=l.show('A',{preview:true}),b=l.show('A');
  await new Promise(r=>setTimeout(r,5));l.clear();gate.resolve();assert.equal(await a,null);assert.equal(await b,null);
  assert.equal(f.calls.filter(x=>x==='manifest.json').length,1);assert.equal(f.calls.filter(x=>x==='A.json').length,1);
  assert.equal(states.at(-1).phase,'clear');
  const ready=await l.show('A'),cached=await l.show('A');assert.equal(ready.records,cached.records);assert.equal(ready.records[0].feature,cached.records[0].feature);
});
test('late hover cannot overwrite clicked village or revive after destroy',async()=>{
  const f=fixture(),gate=deferred(),states=[];f.gates.set('A.json',gate);
  const l=createVillageTreeLoader({fetcher:f.fetcher,changed:s=>states.push(s)});
  const hover=l.show('A',{preview:true});const click=await l.show('B');assert.equal(click.villageId,'B');gate.resolve();assert.equal(await hover,null);assert.equal(states.at(-1).villageId,'B');
  const before=states.length;l.destroy();await l.show('A');assert.equal(states.length,before);assert.equal(l.cache.size,0);
});
test('network errors exposed, explicit retry works, failed shards never cached',async()=>{
  const f=fixture(),states=[];f.setFailure('A.json');const l=createVillageTreeLoader({fetcher:f.fetcher,changed:s=>states.push(s)});
  assert.equal(await l.show('A'),null);assert.equal(states.at(-1).phase,'error');assert.match(states.at(-1).error.message,/503/);assert.equal(l.cache.size,0);
  f.setFailure(null);assert.equal((await l.show('A')).count,2);assert.equal(f.calls.filter(x=>x==='A.json').length,2);
});
test('manifest failures also retry and mismatched bytes reject SHA-256',async()=>{
  const f=fixture(),states=[];f.setFailure('manifest.json');const l=createVillageTreeLoader({fetcher:f.fetcher,changed:s=>states.push(s)});
  assert.equal(await l.show('A'),null);f.setFailure(null);f.files.set('A.json',new TextEncoder().encode('{}'));
  assert.equal(await l.show('A'),null);assert.match(states.at(-1).error.message,/SHA-256/);assert.equal(l.cache.size,0);
});
test('LRU never retains more than eight villages and evicted entry refetches',async()=>{
  const f=fixture(Array.from({length:10},(_,i)=>String(i)));const l=createVillageTreeLoader({fetcher:f.fetcher});
  for(let i=0;i<10;i++)assert.ok(await l.show(String(i)));assert.equal(l.cache.size,8);assert.ok(!l.cache.has('0'));
  await l.show('0');assert.equal(f.calls.filter(x=>x==='0.json').length,2);assert.equal(l.cache.size,8);
});
test('strict metadata snapshot source hashes and safe relative file validation',()=>{
  const {manifest:m}=fixture();assert.equal(validateVillageManifest(m,snapshot,{'street-trees.geojson':hash}),m);
  assert.throws(()=>validateVillageManifest(m,snapshot,{'regions.json':hash}),'caller-required boundary hash may not be omitted');assert.throws(()=>validateVillageManifest(m,'wrong'));assert.throws(()=>validateVillageManifest(m,snapshot,{'street-trees.geojson':'b'.repeat(64)}));
  for(const file of ['../A.json','https://evil/A.json','/A.json','A.json?x','A-json']){const bad=structuredClone(m);bad.villages.A.file=file;assert.throws(()=>validateVillageManifest(bad));}
  const bad=structuredClone(m);bad.villages.A.count++;assert.throws(()=>validateVillageManifest(bad));
});
test('uncapped records keep every original field and coincident identity; real zero is valid',()=>{
  const f=fixture(['A'],160001),entry=f.manifest.villages.A,shard=JSON.parse(new TextDecoder().decode(f.files.get('A.json')));
  const before=JSON.stringify(shard.records[0]);assert.equal(validateVillageShard(shard,entry,snapshot),shard.records);assert.equal(shard.records.length,160001);assert.equal(JSON.stringify(shard.records[0]),before);
  assert.equal(samePointRecords(shard.records,shard.records[0]).length,160001);
  const z=fixture(['Z'],0),zero=JSON.parse(new TextDecoder().decode(z.files.get('Z.json')));assert.deepEqual(validateVillageShard(zero,z.manifest.villages.Z,snapshot),[]);
});
test('schema IDs exact counts per-source identity duplicates and coordinates all fail explicitly',()=>{
  const f=fixture(['A']),entry=f.manifest.villages.A,original=JSON.parse(new TextDecoder().decode(f.files.get('A.json')));
  for(const mutate of [s=>s.schemaVersion=2,s=>s.villageId='B',s=>s.treeSnapshot='other',s=>s.records.pop(),s=>s.records[0].treeId='other',s=>{s.records[0].treeId=0;s.records[0].feature.properties.TreeID=0;},s=>s.records[1]=structuredClone(s.records[0]),s=>s.records[0].feature.geometry.coordinates=[181,25],s=>s.records[0].feature.geometry.coordinates=[121,Infinity],s=>s.records[0].sourceIndex=-1,s=>s.records[0].layerId='parks']){const s=structuredClone(original);mutate(s);assert.throws(()=>validateVillageShard(s,entry,snapshot));}
  original.records[1].layerId='park-trees';assert.throws(()=>validateVillageShard(original,entry,snapshot));
});
test('renderer contract is separate unclustered canvas with capture hit test and stable selectors',()=>{
  assert.match(source,/L.circleMarker/);assert.match(source,/zIndex = '470'/);assert.match(source,/pointerEvents = 'none'/);assert.match(source,/dataset.renderedCount/);assert.match(source,/village-tree-popup/);assert.ok(source.includes("addEventListener('click',hit,true)"));assert.ok(!source.includes('gridGroups'));assert.ok(!source.includes('renderPointLayer'));assert.ok(!source.includes('innerHTML'));
});
