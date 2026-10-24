import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {speciesName,UNKNOWN_SPECIES} from '../src/species.js';
import {BLUEPRINT_NAMES,BLUEPRINT_SHA256,GAME_SHA256,DEMO_WINDOW,demoMetrics,seededHash,applySocialMetrics} from '../src/workspaces/02/social-metrics.js';
const read=p=>readFile(new URL('../'+p,import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const game=JSON.parse(await read('public/data/village-game.json')),metrics=JSON.parse(await read('public/data/social-metrics.json'));
test('compact exact19 source pins and public provenance without image',async()=>{
 assert.equal(sha(await read('public/data/village-game.json')),GAME_SHA256);
 assert.equal(metrics.blueprint.sha256,BLUEPRINT_SHA256);assert.equal(BLUEPRINT_NAMES.length,19);assert.equal(new Set(BLUEPRINT_NAMES).size,19);
 assert.deepEqual(BLUEPRINT_NAMES,['臺灣山櫻花','杜鵑','紅楠','臺灣水青岡','臺灣二葉松','相思樹','樟樹','楠木','山黃麻','臺灣欒樹','青剛櫟','山胡椒','月橘','厚葉石斑木','苦楝','水柳','蘆葦','臺灣野薑花','水社柳']);
 assert.deepEqual(metrics.blueprint.names,BLUEPRINT_NAMES);assert.match(metrics.blueprint.attribution,/洪睿晉/);assert.match(metrics.blueprint.provenanceUrl,/^https:/);
 assert.equal(metrics.blueprint.unlistedPolicy,'assumed-non-native-for-demo-not-botanical-fact');
 assert.equal(Object.hasOwn(metrics.blueprint,'sourceImage'),false);assert.equal(Object.hasOwn(metrics.blueprint,'regions'),false);assert.ok(!JSON.stringify(metrics).includes('data:image'));
 for(const [file,h]of Object.entries(metrics.inputHashes))assert.equal(sha(await read('public/data/'+file)),h);
 assert.deepEqual(metrics.demoWindow,DEMO_WINDOW);assert.ok(Date.parse(metrics.preparedAt)>=Date.parse('2026-10-24'));
});
test('independent original-feature reconstruction of ALL456 exact native counts',async()=>{
 const regions=JSON.parse(await read('public/data/regions.json')),expected=new Map(game.villages.map(v=>[v.id,{total:0,matched:0,unlisted:0,unknown:0,dead:0}]));
 const names=new Set(BLUEPRINT_NAMES);let global=0,unmatched=0;
 for(const layer of ['street-trees','park-trees']){
  const bytes=await read('public/data/'+layer+'.geojson');assert.equal(sha(bytes),game.inputHashes[layer+'.geojson']);
  const {features}=JSON.parse(bytes);for(let i=0;i<features.length;i++){
   global++;const index=regions.membership[layer][i];if(index<0){unmatched++;continue;}
   const n=expected.get(regions.features[index].properties.id),name=speciesName(features[i].properties.TreeType);n.total++;
   if(name===UNKNOWN_SPECIES)n.unknown++;else if(name==='枯木')n.dead++;else if(names.has(name))n.matched++;else n.unlisted++;
  }
 }
 assert.equal(global,162369);assert.equal(unmatched,48);assert.equal(expected.size,456);
 for(const row of metrics.villages){const e=expected.get(row.id);assert.deepEqual(row.native,{...e,coverage:e.total?(e.total-e.unknown-e.dead)/e.total:0});assert.equal(row.scores.nativeShare,e.total?100*(e.matched/e.total):0);assert.equal(e.matched+e.unlisted+e.unknown+e.dead,e.total);}
 assert.deepEqual(metrics.totals,{total:162321,matched:24618,unlisted:137678,unknown:18,dead:7});
 // No alias expansion: these common alternate labels are deliberately absent.
 for(const alias of ['台灣欒樹','山櫻花','櫻花','楓香','榕樹'])assert.ok(!names.has(speciesName(alias)));
});
test('seeded demo repeatability, variation, bounded counts, zero semantics, no actual-report metadata',()=>{
 assert.deepEqual(demoMetrics('zero',0),{birdInsect:{simulated:true,score:seededHash('zero','birdInsect')%101},activity:{simulated:true,windowDays:7,dueCount:0,reportedCount:0,rate:0}});
 assert.throws(()=>demoMetrics('bad',-1));assert.throws(()=>demoMetrics('',1));
 for(const row of metrics.villages){const demo=demoMetrics(row.id,row.native.total);assert.deepEqual(demoMetrics(row.id,row.native.total),demo);assert.deepEqual(row.activity,demo.activity);assert.deepEqual(row.birdInsect,demo.birdInsect);assert.ok(row.birdInsect.score>=0&&row.birdInsect.score<=100);assert.ok(Number.isSafeInteger(row.activity.reportedCount));assert.ok(row.activity.reportedCount<=row.native.total);assert.equal(row.activity.dueCount,row.native.total);assert.equal(row.activity.rate,row.native.total?row.activity.reportedCount/row.native.total*100:0);}
 assert.ok(new Set(metrics.villages.map(r=>r.birdInsect.score)).size>90);assert.ok(new Set(metrics.villages.map(r=>r.activity.rate)).size>100);
 assert.deepEqual(metrics.simulation.birdInsect,true);assert.equal(metrics.simulation.activity,true);assert.match(metrics.simulation.notice,/並非真實觀測、回報或上傳/);
 assert.ok(!Object.hasOwn(metrics,'reports'));assert.ok(!Object.hasOwn(metrics,'uploads'));
});
test('adapter pure, preserves original scores/source, returns scored zero native on zero trees',()=>{
 const before=structuredClone(game),mb=structuredClone(metrics),out=applySocialMetrics(game,metrics);assert.notEqual(out,game);assert.deepEqual(game,before);assert.deepEqual(metrics,mb);
 for(let i=0;i<456;i++){
  const original=game.villages[i],v=out.villages[i];assert.notEqual(v,original);assert.notEqual(v.scores,original.scores);
  for(const key of Object.keys(original.scores))assert.equal(v.scores[key],original.scores[key]);
  assert.deepEqual(Object.fromEntries(Object.entries(v).filter(([k])=>k!=='scores'&&k!=='socialMetrics')),Object.fromEntries(Object.entries(original).filter(([k])=>k!=='scores')));
  assert.equal(v.scores.nativeShare,v.socialMetrics.scores.nativeShare);if(!v.trees){assert.equal(v.scores.nativeShare,0);assert.equal(v.scores.activity,0);assert.equal(v.socialMetrics.native.coverage,0);}
 }
 out.villages[0].socialMetrics.native.total=-1;assert.deepEqual(metrics,mb);
});
test('fail closed on missing/zero hashes, snapshot/version/IDs, scores/counts/policy drift',()=>{
 const mutations=[m=>delete m.inputHashes,m=>m.inputHashes['village-game.json']='0'.repeat(64),m=>m.inputHashes['regions.json']='0'.repeat(64),m=>delete m.inputHashes['park-trees.geojson'],m=>m.treeSnapshot='wrong',m=>m.seed='wrong',m=>m.version='wrong',m=>m.villages.pop(),m=>m.villages[1].id=m.villages[0].id,m=>m.villages[0].native.matched++,m=>m.villages[0].native.coverage=NaN,m=>m.villages[0].scores.nativeShare=NaN,m=>m.villages[0].activity.reportedCount++,m=>m.villages[0].birdInsect.simulated=false,m=>m.totals.total++,m=>m.blueprint.names.push('榕樹'),m=>m.blueprint.sha256='0'.repeat(64),m=>m.blueprint.unlistedPolicy='botanical-fact',m=>m.demoWindow.days=8];
 for(const mutate of mutations){const m=structuredClone(metrics);mutate(m);assert.throws(()=>applySocialMetrics(game,m),/Social metrics validation/);}
 const g=structuredClone(game);g.treeSnapshot='wrong';assert.throws(()=>applySocialMetrics(g,metrics));
});
