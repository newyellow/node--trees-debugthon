import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRadarGeometry as geometry } from '../src/workspaces/02/capability-radar.js';
const axes = values => values.map((value, i) => ({key:'a'+i,label:'完整項目 '+i,color:'#238443',value}));
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-9, a+' != '+b);
test('radar: cardinal symmetry, clockwise from top, maximum and rings', () => {
 const g=geometry(axes([100,100,100,100]));
 assert.equal(g.complete,true); assert.equal(g.polygon.length,4); assert.equal(g.rings.length,4);
 const expected=[[90,36],[144,90],[90,144],[36,90]];
 g.polygon.forEach((p,i)=>{close(p.x,expected[i][0]);close(p.y,expected[i][1]);});
 g.axes.forEach((a,i)=>close(a.angle,-Math.PI/2+i*Math.PI/2));
 close(Math.hypot(g.rings[0][0].x-90,g.rings[0][0].y-90),13.5);
});
test('radar: real zero at center is not missing, including all zero',()=>{
 const g=geometry(axes([0,0,0]));assert.equal(g.complete,true);
 for(const p of g.polygon)assert.deepEqual(p,g.center);
 const partial=geometry(axes([0,null,100]));assert.deepEqual(partial.axes[0].point,partial.center);
 assert.equal(partial.axes[1].point,null);assert.equal(partial.polygon,null);
});
test('radar: invalid values never coerce to zero or yield filled missing region',()=>{
 for(const value of [null,undefined,NaN,Infinity,-Infinity,-1,101,'50','',false]){
  const g=geometry(axes([50,value,100]));assert.equal(g.axes[1].value,null);assert.equal(g.axes[1].point,null);assert.equal(g.complete,false);assert.equal(g.polygon,null);assert.equal(g.segments.length,1);
 }
});
test('radar: only adjacent known endpoints connect, including wraparound',()=>{
 const g=geometry(axes([20,30,null,50,null,80]));assert.equal(g.polygon,null);assert.equal(g.segments.length,2);
 assert.deepEqual(g.segments[0],{from:g.axes[0].point,to:g.axes[1].point});
 assert.deepEqual(g.segments[1],{from:g.axes[5].point,to:g.axes[0].point});
 for(const values of [[null,null,null],[null,50,null]]){const g=geometry(axes(values));assert.equal(g.segments.length,0);assert.equal(g.polygon,null);}
});
test('radar: variable axis counts and sizes have finite in-bounds coordinates',()=>{
 for(const size of [1,110,180,320,10000])for(const n of [3,4,5,6,12,100]){
  const input=axes(Array.from({length:n},(_,i)=>i%3===0?null:i%3===1?0:100));
  const g=geometry(input,{size});
  for(const p of [g.center,...g.rings.flat(),...g.axes.flatMap(a=>[a.end,a.labelPoint,...a.point?[a.point]:[]])]){
   assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=0&&p.x<=size&&p.y>=0&&p.y<=size);
  }
  close(g.radius,size*.3);assert.ok(!JSON.stringify(g).includes('NaN'));
 }
});
test('radar: pure, deterministic, preserves labels and uses safe colors',()=>{
 const input=axes([0,25,100]);input[0].label='<img onerror=alert(1)>';input[0].color='url(https://invalid)';
 Object.freeze(input);input.forEach(Object.freeze);
 const g=geometry(input);assert.deepEqual(g,geometry(input));assert.equal(g.axes[0].label,input[0].label);assert.equal(g.axes[0].color,'#53666f');assert.equal(g.axes[1].color,'#238443');
 close(Math.hypot(g.axes[1].point.x-90,g.axes[1].point.y-90),g.radius*.25);
});
test('radar: reject unsupported axes and sizes',()=>{
 for(const a of [undefined,null,[],axes([1,2])])assert.throws(()=>geometry(a),TypeError);
 for(const size of [0,-1,Infinity,NaN,'180',10001])assert.throws(()=>geometry(axes([0,50,100]),{size}),RangeError);
});
