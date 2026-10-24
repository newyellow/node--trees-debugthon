import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gridGroups, matches } from '../src/explorer.js';
const source=await readFile(new URL('../src/workspaces/02/record-layers.js',import.meta.url),'utf8');
// Exercise exported state/validation logic without importing browser-only Leaflet.
const pure=source.split(String.fromCharCode(10)).filter(line=>!line.startsWith('import ')).join(String.fromCharCode(10));
const {createRecordLoader,validateRecordDefinitions,validateRecordCollection,buildTreeExclusions,filterExcludedTreeRecords}=await import('data:text/javascript;base64,'+Buffer.from(pure).toString('base64'));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
test('parallel enables deduplicate and late completion never resurrects unchecked layer',async()=>{
  const task=deferred();let calls=0;const loader=createRecordLoader(()=>{calls++;return task.promise;});
  const a=loader.enable('trees',true),b=loader.enable('trees',true);assert.equal(a,b);
  await loader.enable('trees',false);task.resolve({features:[1]});await a;
  assert.equal(calls,1);assert.equal(loader.records.get('trees').enabled,false);
  await loader.enable('trees',true);assert.equal(calls,1);assert.equal(loader.records.get('trees').enabled,true);
});
test('failed loads expose error and explicit re-enable retries then caches success',async()=>{
  let calls=0;const loader=createRecordLoader(()=>{if(++calls===1)throw new Error('offline');return{features:[]};});
  await loader.enable('bins',true);assert.equal(loader.records.get('bins').status,'error');assert.match(loader.records.get('bins').error.message,/offline/);
  await loader.enable('bins',true);assert.equal(calls,2);assert.equal(loader.records.get('bins').status,'ready');
  await loader.enable('bins',false);await loader.enable('bins',true);assert.equal(calls,2);
});
test('destroy suppresses delayed notifications and disables records',async()=>{
  const task=deferred();let notifications=0;const loader=createRecordLoader(()=>task.promise,()=>notifications++);
  const p=loader.enable('trees',true);loader.destroy();const before=notifications;task.resolve({features:[]});await p;
  assert.equal(notifications,before);assert.equal(loader.records.get('trees').enabled,false);
});
test('definitions validate IDs paths kinds and sanitize untrusted cluster colors',()=>{
  const d={id:'trees',title:'Trees',kind:'point',file:'trees.geojson',color:'red; background:url(x)'};
  assert.equal(validateRecordDefinitions({layers:[d]})[0].color,'#467e72');
  for(const bad of [{...d,file:'../secrets.geojson'},{...d,file:'https://x/a.geojson'},{...d,kind:'script'}])assert.throws(()=>validateRecordDefinitions({layers:[bad]}));
  assert.throws(()=>validateRecordDefinitions({layers:[d,d]}));
});
test('GeoJSON bounds are recomputed, invalid records fail explicitly, no cap drops features',()=>{
  const features=Array.from({length:160001},(_,i)=>({type:'Feature',properties:{_district:i%2?'大安區':'中正區'},geometry:{type:'Point',coordinates:[121.5,25]},bbox:[0,0,0,0]}));
  const result=validateRecordCollection({type:'FeatureCollection',features});assert.equal(result.length,160001);assert.deepEqual(result[0].bbox,[121.5,25,121.5,25]);
  assert.throws(()=>validateRecordCollection({type:'FeatureCollection',features:[{...features[0],geometry:{type:'Point',coordinates:[Infinity,25]}}]}));
});
test('actual district only; shared maxzoom grouping retains every overlapping record',()=>{
  const feature={properties:{_district:'大安區',_name:'甲里'},bbox:[121.5,25,121.5,25]};
  assert.equal(matches(feature,'甲里',''),false);assert.equal(matches(feature,'大安區',''),true);
  const features=Array.from({length:250},()=>structuredClone(feature));
  const groups=gridGroups(features,()=>({x:12345,y:12345}),1);
  assert.equal(groups.length,1);assert.equal(groups[0].features.length,250);
  assert.ok(source.includes('renderPointLayer('));assert.match(source,/new LayerScene/);assert.match(source,/new RBush/);
});

test('raw village exclusions use exact layer and stable TreeID, never position or nearby identity',()=>{
 const records=[{layerId:'street-trees',treeId:'001'},{layerId:'park-trees',treeId:'002'},{layerId:'protected-trees',treeId:'001'},{layerId:'street-trees',treeId:undefined}];const excluded=buildTreeExclusions(records);assert.equal(excluded.size,2);
 const features=['001','1','002','003'].map(TreeID=>({properties:{TreeID},geometry:{type:'Point',coordinates:[121.5,25]}}));
 assert.deepEqual(filterExcludedTreeRecords(features,excluded.get('street-trees')).map(f=>f.properties.TreeID),['1','002','003']);
 assert.deepEqual(filterExcludedTreeRecords(features,excluded.get('park-trees')).map(f=>f.properties.TreeID),['001','1','003']);assert.equal(filterExcludedTreeRecords(features,new Set()),features);assert.equal(features.length,4);
});
