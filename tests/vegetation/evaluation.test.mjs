import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {evaluateMasks,poolEvaluations,blockedHoldout,evaluatePilot,CACHED12_TILE_IDS} from '../../src/vegetation/evaluation.js';
// ALL fixtures here are synthetic; none represent measured pilot accuracy.
const classes=['background','canopy'];
const evaluate=(truth,prediction,extra={})=>evaluateMasks({truth,prediction,classes,truthMapping:{0:'background',1:'canopy'},predictionMapping:{0:'background',1:'canopy'},...extra});
test('synthetic binary TP FP FN TN and exact metrics',()=>{
 const r=evaluate([1,1,1,0,0,0],[1,1,0,1,0,0],{pixelAreaM2:2});
 assert.deepEqual(r.confusion,[[2,1],[1,2]]);
 assert.deepEqual(r.perClass.canopy,{TP:2,FP:1,FN:1,TN:2,precision:2/3,recall:2/3,F1:2/3,IoU:1/2,truthAreaM2:6,predictedAreaM2:6,signedRelativeAreaError:0,relativeAreaError:0});
});
test('synthetic zero denominators stay null, including absent truth area',()=>{
 const r=evaluate([0,0],[0,0]).perClass.canopy;
 for(const k of ['precision','recall','F1','IoU','relativeAreaError','signedRelativeAreaError'])assert.equal(r[k],null);
 const fp=evaluate([0],[1]).perClass.canopy;assert.equal(fp.precision,0);assert.equal(fp.recall,null);assert.equal(fp.F1,0);assert.equal(fp.relativeAreaError,null);
 assert.equal(evaluate([],[]).evaluatedFraction,null);
});
test('synthetic explicit nodata, unknown, shadow and material labels are ignored on either side',()=>{
 const r=evaluate([1,255,'materialUnknown','shadowUnknown',1,0,1],[1,1,1,1,255,0,0],{validMask:[1,1,1,1,1,0,1]});
 assert.equal(r.evaluatedPixels,2);assert.deepEqual(r.excluded,{invalidMask:1,unknownTruth:3,unknownPrediction:1});
 assert.equal(r.perClass.canopy.FN,1);
});
test('synthetic multiclass mappings and per-pixel projected areas',()=>{
 const r=evaluateMasks({classes:['canopy','lowveg','roofCandidate'],truth:['a','b','c'],prediction:[10,10,30],truthMapping:{a:'canopy',b:'lowveg',c:'roofCandidate'},predictionMapping:{10:'canopy',30:'roofCandidate'},pixelAreaM2:[2,3,4]});
 assert.equal(r.perClass.canopy.IoU,.5);assert.equal(r.perClass.lowveg.IoU,0);assert.equal(r.perClass.roofCandidate.IoU,1);
 assert.equal(r.perClass.canopy.relativeAreaError,1.5);assert.equal(r.perClass.lowveg.signedRelativeAreaError,-1);
});
test('synthetic pooled metrics use counts rather than mean tile ratios',()=>{
 const a=evaluate([1],[1]),b=evaluate([1,1,1],[0,0,0]),r=poolEvaluations([a,b]);
 assert.equal(r.perClass.canopy.recall,.25);assert.equal(r.perClass.canopy.F1,.4);assert.deepEqual(r.confusion,[[0,0],[3,1]]);
 assert.throws(()=>poolEvaluations([]));assert.throws(()=>poolEvaluations([a,{...b,classes:['x']} ]));
});
test('synthetic malformed inputs rejected',()=>{
 assert.throws(()=>evaluate([1],[]));assert.throws(()=>evaluate([1],[1],{validMask:[]}));
 for(const pixelAreaM2 of [0,-1,NaN,Infinity,[0],[]])assert.throws(()=>evaluate([1],[1],{pixelAreaM2}));
 assert.throws(()=>evaluate([1],[1],{validMask:[255]}));assert.throws(()=>evaluate([1],[1],{classes:['shadowUnknown']}));
});
const blocks=()=>Array.from({length:12},(_,i)=>({id:'tile'+i,block:'b'+Math.floor(i/2),stratum:'mixed'}));
test('synthetic blocked assignment is deterministic and tile/block disjoint',()=>{
 const tiles=blocks(),r=blockedHoldout(tiles),reversed=blockedHoldout([...tiles].reverse());assert.deepEqual(r,reversed);
 const sets=['train','validation','test'].map(k=>new Set(r[k]));assert.equal(new Set(sets.flatMap(s=>[...s])).size,12);
 for(let i=0;i<12;i+=2)assert.ok(sets.some(s=>s.has('tile'+i)&&s.has('tile'+(i+1))));
 assert.throws(()=>blockedHoldout([...tiles,tiles[0]]));assert.throws(()=>blockedHoldout(tiles.slice(0,4)));
});
test('synthetic spatial embargo buffers lower-priority neighbors or refuses empty partition',()=>{
 const tiles=blocks(),r=blockedHoldout(tiles),testId=r.test[0],trainId=r.train[0];
 const a=tiles.find(t=>t.id===testId).block,b=tiles.find(t=>t.id===trainId).block;
 const q=blockedHoldout(tiles,{embargoEdges:[[a,b]]});assert.ok(q.buffer.includes(trainId));assert.ok(q.test.includes(testId));
 assert.throws(()=>blockedHoldout(tiles,{embargoEdges:[['absent',a]]}));
 const one=tiles.filter((_,i)=>i%2===0).slice(0,3),p=blockedHoldout(one);
 const tb=one.find(t=>t.id===p.test[0]).block,tr=one.find(t=>t.id===p.train[0]).block;
 assert.throws(()=>blockedHoldout(one,{embargoEdges:[[tb,tr]]}),/insufficient/);
});
function syntheticPilot(){
 const n=65536;return {classes,truthMapping:{0:'background',1:'canopy'},predictionMappings:{baseline:{0:'background',1:'canopy'},candidate:{0:'background',1:'canopy'}},tiles:CACHED12_TILE_IDS.map(id=>({id,width:256,height:256,sourceSha256:'0'.repeat(64),pixelAreaM2:1,truth:Array(n).fill(0),predictions:{baseline:{pre:Array(n).fill(0),post:Array(n).fill(0)},candidate:{pre:Array(n).fill(0),post:Array(n).fill(0)}}}))};
}
test('synthetic exact12 comparison freezes common support across candidates and stages',()=>{
 const input=syntheticPilot();input.tiles[0].truth[0]=1;input.tiles[0].predictions.candidate.post[0]=255;
 const r=evaluatePilot(input);assert.equal(r.support[0].commonKnownPixels,65535);assert.equal(r.support[0].unknownByCandidate.candidate.post,1);
 assert.equal(r.candidates.baseline.pre.pooled.evaluatedPixels,12*65536-1);assert.equal(r.candidates.candidate.post.pooled.evaluatedPixels,r.candidates.baseline.pre.pooled.evaluatedPixels);
 assert.equal(r.candidates.baseline.pre.pooled.perClass.canopy.recall,null);
 input.tiles[0].id='other';assert.throws(()=>evaluatePilot(input),/cached12/);
});
test('synthetic pilot rejects mismatched stages, dimensions and missing provenance',()=>{
 const input=syntheticPilot(),t=input.tiles[0];t.width=255;assert.throws(()=>evaluatePilot(input),/256/);t.width=256;
 t.sourceSha256=null;assert.throws(()=>evaluatePilot(input),/SHA256/);t.sourceSha256='0'.repeat(64);
 t.predictions.candidate.post=[];assert.throws(()=>evaluatePilot(input),/pre\/post/);
});
test('local CLI help and remote URL refusal; no download',()=>{
 const cli=new URL('../../scripts/vegetation/evaluate-masks.mjs',import.meta.url).pathname;
 const help=spawnSync(process.execPath,[cli,'--help'],{encoding:'utf8'});assert.equal(help.status,0,help.stderr);assert.match(help.stdout,/LOCAL_MANIFEST/);
 const bad=spawnSync(process.execPath,[cli,'https://invalid.example/test'],{encoding:'utf8'});assert.equal(bad.status,1);assert.match(bad.stderr,/local JSON/);
});

test('synthetic multiple strata each retain whole blocks in every partition',()=>{
 const tiles=Array.from({length:12},(_,i)=>({id:'s'+i,block:'s'+i,stratum:i<6?'built':'vegetated'}));
 const r=blockedHoldout(tiles);
 for(const part of ['train','validation','test'])for(const stratum of ['built','vegetated'])assert.ok(r[part].some(id=>tiles.find(t=>t.id===id).stratum===stratum));
 const conflict=[...blocks(),{id:'extra',block:'b0',stratum:'different'}];assert.throws(()=>blockedHoldout(conflict),/one stratum/);
});
test('synthetic all-unknown support never becomes successful empty-class accuracy',()=>{
 const r=evaluate([255,'shadowUnknown'],[1,0]);assert.equal(r.evaluatedPixels,0);assert.equal(r.evaluatedFraction,0);
 for(const c of classes)for(const k of ['precision','recall','F1','IoU','relativeAreaError'])assert.equal(r.perClass[c][k],null);
 const invalid=evaluate([1],[0],{validMask:[false]});assert.equal(invalid.excluded.invalidMask,1);assert.equal(invalid.perClass.canopy.FN,0);
});
