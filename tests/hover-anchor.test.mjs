import test from 'node:test';
import assert from 'node:assert/strict';
import {interiorAnchor} from '../src/workspaces/02/hover-anchor.js';
const inside=(p,r)=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
test('hover anchor: concave, hole, separated parts and narrow geometry stay interior',()=>{
 const square=[[0,0],[10,0],[10,10],[0,10],[0,0]],hole=[[1,1],[9,1],[9,9],[1,9],[1,1]],concave=[[0,0],[10,0],[10,1],[1,1],[1,10],[0,10],[0,0]],island=[[20,0],[22,0],[22,2],[20,2],[20,0]];
 for(const polygons of [[[concave]],[[square,hole]],[[concave],[island]],[[[[0,0],[10,0],[10,.001],[0,.001],[0,0]]]]]){const p=interiorAnchor(polygons);assert.ok(p);assert.ok(polygons.some(r=>inside(p,r[0])&&!r.slice(1).some(h=>inside(p,h))));assert.deepEqual(interiorAnchor(polygons),p);}
 assert.equal(interiorAnchor([]),null);assert.equal(interiorAnchor([[[[0,0],[1,0],[0,0]]]]),null);
});
