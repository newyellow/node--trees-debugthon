import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyRGB,features,PARAMS,VERSION} from '../../src/vegetation/candidates.js';
import {isGreen} from '../../src/vegetation/geometry.js';
const run=(pixels,w=pixels.length,options={})=>classifyRGB(Uint8Array.from(pixels.flatMap(p=>p.length===4?p:[...p,255])),w,pixels.length/w,options);
test('SYNTHETIC normalized indices invariant to brightness above unknown floor',()=>{const a=features(40,80,30),b=features(80,160,60);assert.equal(a.exg,b.exg);assert.equal(a.gli,b.gli);assert.deepEqual([...run([[40,80,30],[80,160,60]]).pre],[1,1]);});
test('SYNTHETIC black gray shadow unknown, transparent nodata distinct',()=>{const r=run([[0,0,0],[100,100,100],[10,30,10],[0,200,0,0],[150,40,30]]);assert.deepEqual([...r.unknown],[1,1,1,0,0]);assert.deepEqual([...r.valid],[1,1,1,0,1]);assert.deepEqual([...r.pre],[255,255,255,255,0]);});
test('SYNTHETIC painted green is known unresolved false positive, not canopy proof',()=>{assert.equal(run([[40,180,50]]).post[0],1);});
test('SYNTHETIC nodata and unknown excluded from smoothing and support',()=>{const p=[[40,100,40],[80,100,80],[0,255,0,0]];const a=run(p,3,{smoothing:true});assert.equal(a.pre[2],255);const b=run([[40,100,40],[80,100,80],[255,0,255,0]],3,{smoothing:true});assert.deepEqual(a,b);assert.equal(run([[80,100,80]],1,{validMask:[0]}).pre[0],255);});
test('SYNTHETIC isolated small structures preserved, gaps not closed',()=>{const r=run([[40,100,40],[160,60,50],[40,100,40]],3,{smoothing:true});assert.deepEqual([...r.post],[1,0,1]);});
test('SYNTHETIC weak support one pass only, no all foreground',()=>{const weak=[88,100,88],strong=[30,120,30];const r=run([strong,weak,strong],3);assert.deepEqual([...r.pre],[1,0,1]);assert.deepEqual([...r.post],[1,1,1]);assert.deepEqual([...run([weak,weak,weak]).post],[0,0,0]);});
test('SYNTHETIC exact existing baseline and deterministic parameters',()=>{const p=[[30,120,30],[80,100,80],[15,25,15],[200,200,200],[40,180,50]];assert.deepEqual([...run(p).baseline],p.map(v=>+isGreen(...v)));assert.deepEqual(run(p),run(p));assert.ok(Object.isFrozen(PARAMS));assert.equal(VERSION,'normalized-rgb-experimental-v1');});
test('SYNTHETIC malformed and oversized inputs rejected',()=>{assert.throws(()=>classifyRGB([],1025,768));assert.throws(()=>classifyRGB([NaN,0,0,255],1,1));assert.throws(()=>run([[20,80,20]],1,{smoothing:1}));assert.throws(()=>run([[20,80,20]],1,{validMask:[2]}));});

import {classifyHysteresis,HYSTERESIS_PARAMS,strictGateDiagnostics} from '../../src/vegetation/candidates.js';
const hrun=(p,w=p.length,opts={})=>classifyHysteresis(Uint8Array.from(p.flatMap(v=>v.length===4?v:[...v,255])),w,p.length/w,opts);
test('SYNTHETIC v2 all baseline retained including dark and low-saturation yellowgreen',()=>{const p=[[150,167,156],[28,39,30],[40,180,50],[30,120,30]];const r=hrun(p);for(let i=0;i<p.length;i++){assert.ok(isGreen(...p[i]));assert.equal(r.post[i],1);assert.equal(r.unknown[i],0);}assert.deepEqual(r,hrun(p));assert.ok(Object.isFrozen(HYSTERESIS_PARAMS));});
test('SYNTHETIC v2 weak edge recover only with two cardinal original baseline seeds',()=>{const s=[30,120,30],w=[94,100,94];const r=hrun([s,w,s]);assert.deepEqual([...r.pre],[1,0,1]);assert.deepEqual([...r.post],[1,1,1]);assert.deepEqual([...hrun([w,w,w]).post],[0,0,0]);});
test('SYNTHETIC v2 nodata unknown barriers and boundary no wrapping',()=>{const s=[30,120,30],w=[94,100,94],gray=[100,100,100];assert.deepEqual([...hrun([s,[0,255,0,0],w,s]).post],[1,255,0,1]);assert.deepEqual([...hrun([s,gray,w,s]).post],[1,255,0,1]);const r=hrun([s,w,s],3,{validMask:[1,1,0]});assert.deepEqual([...r.post],[1,0,255]);});
test('SYNTHETIC v2 no iterative propagation',()=>{const s=[30,120,30],w=[94,100,94],b=[180,70,50];const r=hrun([b,s,b,s,w,w,b,s,s],3);assert.equal(r.post[4],1);assert.equal(r.post[5],0);});
test('SYNTHETIC gate reasons independent and counted only over stated support',()=>{const d=strictGateDiagnostics(Uint8Array.from([150,167,156,255,0,0,0,0]));assert.equal(d.valid,1);assert.equal(d.baselineGreen,1);assert.equal(d.baselineGates.lowSaturation,1);assert.equal(d.baselinePassAll,0);});

