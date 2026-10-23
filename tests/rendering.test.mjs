import test from 'node:test';
import assert from 'node:assert/strict';
import { LayerScene } from '../src/layer-scene.js';
import { AnalysisCache } from '../src/analysis-cache.js';
import { gridGroups } from '../src/explorer.js';

function scene() {
  const active = new Set();
  return new LayerScene({ addLayer: layer => active.add(layer), removeLayer: layer => active.delete(layer) });
}
test('pan reuses surviving layer identity and only adds/removes the viewport difference', () => {
  const s = scene(), create = key => ({ key });
  s.begin('points');
  const a = s.use('a',1,()=>create('a')), b = s.use('b',1,()=>create('b'));
  assert.deepEqual(s.finish(), {added:2,removed:0,reused:0,styled:0,total:2});
  s.begin('points');
  assert.equal(s.use('b',1,()=>assert.fail('recreated retained layer')),b);
  s.use('c',1,()=>create('c'));
  assert.deepEqual(s.finish(), {added:1,removed:1,reused:1,styled:0,total:2});
  assert.ok(!s.entries.has('a')); assert.ok(a !== b);
});
test('opacity restyles a retained layer; semantic changes and mode changes invalidate it', () => {
  const s=scene(); s.begin('grid');
  const layer=s.use('x','data',()=>({}),.6); s.finish();
  s.begin('grid');
  assert.equal(s.use('x','data',()=>assert.fail('recreated on opacity change'),.8,l=>{l.opacity=.8;}),layer);
  assert.deepEqual(s.finish(),{added:0,removed:0,reused:1,styled:1,total:1});
  assert.equal(layer.opacity,.8);
  s.begin('grid'); assert.notEqual(s.use('x','new data',()=>({})),layer);
  assert.equal(s.finish().removed,1);
  s.begin('district'); assert.equal(s.entries.size,0); s.finish();
});
test('revisiting an identical viewport causes no layer additions, removals or style calls', () => {
  const s=scene();
  for(let frame=0;frame<2;frame++){
    s.begin('grid');
    for(let i=0;i<100;i++)s.use(i,'fixed',()=>({}),.6,()=>assert.fail('unnecessary restyle'));
    const stats=s.finish();
    if(frame)assert.deepEqual(stats,{added:0,removed:0,reused:100,styled:0,total:100});
  }
});
test('sidewalk requests contain only uncached/unrequested indices, including rapid pans and late responses', () => {
  const cache=new AnalysisCache();
  assert.deepEqual(cache.request('A',[1,2,3]),[1,2,3]);
  assert.deepEqual(cache.request('A',[2,3,4]),[4]);
  cache.complete('A',[1,2,3],[{index:1},{index:2},{index:3}]);
  assert.deepEqual(cache.request('A',[1,2,3]),[]);
  cache.complete('A',[4],[{index:4}]);
  assert.equal(cache.get('A').rows.size,4);
  assert.deepEqual(cache.request('B',[1,2]),[1,2]);
  cache.complete('B',[1,2],null,'failed'); assert.equal(cache.get('B').pending.size,0);
  cache.retry(); assert.equal(cache.get('B').error,null);
  assert.deepEqual(cache.request('B',[1,2]),[1,2]);
  assert.deepEqual(cache.request('A',[1,2,3,4]),[]);
});
test('analysis cache evicts old completed configurations but preserves in-flight requests', () => {
  const cache=new AnalysisCache(2);
  cache.request('pending',[0]); cache.get('old'); cache.get('latest');
  assert.ok(cache.configs.has('pending')); assert.ok(!cache.configs.has('old'));
  cache.failAll('worker terminated');
  assert.equal(cache.get('pending').pending.size,0);
});
test('world grid has stable identifiers and full counts independent of viewport filtering', () => {
  const features=[0,1,2].map(i=>({bbox:[121.5+i*.0001,25,121.5+i*.0001,25]}));
  const project=([lat,lng])=>({x:lng*100,y:lat*100});
  const a=gridGroups(features,project,56), b=gridGroups(features,project,56);
  assert.equal(a[0].key,b[0].key); assert.equal(a[0].features.length,3); assert.equal(a[0].lat,b[0].lat);
});
