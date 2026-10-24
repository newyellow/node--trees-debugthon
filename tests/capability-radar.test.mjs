import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRadarGeometry as geometry, createCapabilityRadar } from '../src/workspaces/02/capability-radar.js';
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

test('radar: six emoji axes keep measurements separate from zero-radius display',()=>{
 const emoji=['🌳','🌿','🦋','🌱','🍃','🐦'];
 const input=axes([0,25.125,50,100,null,null]).map((a,i)=>({...a,emoji:emoji[i]}));
 const g=geometry(input,{size:240,missingAtZero:true});
 assert.equal(g.axes.length,6);assert.equal(g.complete,false);assert.equal(g.polygon,null);
 assert.equal(g.displayPolygon.length,6);assert.equal(g.missingAtZero,true);
 g.axes.forEach((a,i)=>{assert.equal(a.emoji,emoji[i]);close(a.angle,-Math.PI/2+i*Math.PI/3);});
 for(const i of [4,5]){
  assert.equal(g.axes[i].value,null);assert.equal(g.axes[i].point,null);
  assert.deepEqual(g.axes[i].displayPoint,g.center);assert.deepEqual(g.displayPolygon[i],g.center);
 }
 assert.equal(g.axes[0].value,0);assert.deepEqual(g.axes[0].point,g.center);
 assert.equal(g.axes[1].value,25.125);
 assert.equal(g.segments.length,3); // Display-only edges never contaminate measured segments.
 const defaults=geometry(input);
 assert.equal(defaults.displayPolygon,null);assert.equal(defaults.axes[4].displayPoint,null);
});
test('radar: opt-in invalid values remain missing and never become measurements',()=>{
 for(const value of [null,undefined,NaN,Infinity,-Infinity,-1,101,'50','',false,{},[]]){
  const g=geometry(axes([50,value,100]),{missingAtZero:true});
  assert.equal(g.axes[1].value,null);assert.equal(g.axes[1].point,null);
  assert.deepEqual(g.axes[1].displayPoint,g.center);assert.equal(g.complete,false);
  assert.equal(g.polygon,null);assert.equal(g.displayPolygon.length,3);assert.equal(g.segments.length,1);
 }
 for(const values of [[null,null,null],[null,50,null],[0,0,0]]){
  const g=geometry(axes(values),{missingAtZero:true});
  assert.equal(g.displayPolygon.length,3);
  assert.ok(g.displayPolygon.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 }
 // Only explicit boolean true opts in; absent/false retain gaps.
 for(const missingAtZero of [undefined,false,'true',1]){
  const g=geometry(axes([0,null,100]),{missingAtZero});
  assert.equal(g.axes[1].displayPoint,null);assert.equal(g.displayPolygon,null);
 }
});
test('radar: emoji and opt-in geometry are pure and preserve frozen caller input',()=>{
 const input=axes([0,25,null,100,null,50]).map((a,i)=>Object.freeze({...a,emoji:['🌳','🌿','🦋','🌱','🍃','🐦'][i]}));
 Object.freeze(input);const before=structuredClone(input);
 const options=Object.freeze({size:110,missingAtZero:true});
 const first=geometry(input,options);assert.deepEqual(first,geometry(input,options));assert.deepEqual(input,before);
 first.axes[4].displayPoint.x=-1;assert.deepEqual(geometry(input,options).axes[4].displayPoint,{x:55,y:55});
 assert.equal(geometry(axes([0,0,0])).axes[0].emoji,'');
 const complete=geometry(input.map(a=>({...a,value:0})),options);
 assert.equal(complete.complete,true);assert.deepEqual(complete.displayPolygon,complete.polygon);
});

// Minimal DOM double: reject HTML insertion; inspect the renderer without extra dependencies.
const renderRadar = options => {
 const previous=globalThis.document;
 const element=tag=>({tag,attrs:{},children:[],className:'',textContent:'',style:{setProperty(){}},
  setAttribute(k,v){this.attrs[k]=v;},append(...children){this.children.push(...children);},
  set innerHTML(_){throw new Error('Unsafe HTML insertion');}});
 globalThis.document={createElement:element,createElementNS:(_,tag)=>element(tag)};
 try{return createCapabilityRadar(options);}finally{globalThis.document=previous;}
};
const descendants = node => [node,...node.children.flatMap(descendants)];
const hasClass = (el,cls) => (el.attrs.class || el.className).split(' ').includes(cls);
test('radar render: emoji, exact scores, N/A, missing center outline and real-zero solid point',()=>{
 const input=axes([0,25.125,50,100,null,null]).map((a,i)=>({...a,emoji:['🌳','🌿','🦋','🌱','🍃','🐦'][i]}));
 input[4].label='<img onerror=alert(1)>';
 const root=renderRadar({axes:input,missingAtZero:true});const els=descendants(root);
 assert.deepEqual(els.filter(e=>hasClass(e,'radar-axis-index')).map(e=>e.textContent),['🌳','🌿','🦋','🌱','🍃 N/A','🐦 N/A']);
 assert.equal(els.filter(e=>hasClass(e,'radar-area--missing')).length,1);
 assert.equal(els.filter(e=>hasClass(e,'radar-point')).length,4);
 const zero=els.find(e=>hasClass(e,'radar-point'));assert.equal(zero.attrs.cx,'120');assert.equal(zero.attrs.cy,'120');
 const missing=els.filter(e=>hasClass(e,'radar-missing--center'));assert.equal(missing.length,2);
 missing.forEach(e=>{assert.equal(e.attrs.cx,'120');assert.equal(e.attrs.cy,'120');});
 assert.equal(els.filter(e=>hasClass(e,'radar-missing-cross')).length,2);
 assert.ok(els.some(e=>e.textContent==='25 / 100'));
 assert.equal(els.filter(e=>e.textContent==='N/A（無可用分數）').length,2);
 assert.ok(els.some(e=>e.textContent==='🍃 <img onerror=alert(1)>'));
 const desc=els.find(e=>e.tag==='desc').textContent;
 assert.match(desc,/0–100/);assert.match(desc,/非生態健康/);assert.match(desc,/缺值而非實際 0 分/);
});
test('radar render: generic default retains numeric fallback and unfilled gaps',()=>{
 const els=descendants(renderRadar({axes:axes([0,null,100])}));
 assert.deepEqual(els.filter(e=>hasClass(e,'radar-axis-index')).map(e=>e.textContent),['1','2 N/A','3']);
 assert.equal(els.filter(e=>hasClass(e,'radar-area')).length,0);
 assert.equal(els.filter(e=>hasClass(e,'radar-segment')).length,1);
 const missing=els.find(e=>hasClass(e,'radar-missing'));
 assert.notEqual(missing.attrs.cx,'120');assert.equal(hasClass(missing,'radar-missing--center'),false);
 assert.match(els.find(e=>e.tag==='desc').textContent,/不跨越缺值連線/);
});

test('radar render: compact names sit next to matching icons without replacing full accessible labels',async()=>{
 const {CAPABILITIES}=await import('../src/workspaces/02/domain.js');
 const input=CAPABILITIES.map(c=>({...c,value:50}));
 const els=descendants(renderRadar({axes:input}));
 const labels=els.filter(e=>hasClass(e,'radar-axis-label'));
 assert.deepEqual(labels.map(e=>e.textContent),['綠覆率','受保護樹木量','物種多樣性','原生種比例','鳥類昆蟲','民眾貢獻度']);
 assert.ok(labels.every(e=>[...e.textContent].length<=6));
 const axis=els.filter(e=>hasClass(e,'radar-axis-index'));
 axis.forEach((e,i)=>{assert.equal(e.children[0].textContent,CAPABILITIES[i].emoji);assert.equal(e.children[1],labels[i]);});
 for(const c of CAPABILITIES)assert.ok(els.find(e=>e.tag==='desc').textContent.includes(c.label));
});

test('pixel kit: five honest rings, square nodes at original coordinates, safe six icons and short names',async()=>{
 const {CAPABILITIES}=await import('../src/workspaces/02/domain.js');
 const input=CAPABILITIES.map((c,i)=>({...c,value:[0,21,43,64,87,100][i]}));
 const g=geometry(input,{size:240});const els=descendants(renderRadar({axes:input,pixelStyle:true}));
 assert.equal(els.filter(e=>hasClass(e,'radar-ring')).length,5);
 const nodes=els.filter(e=>hasClass(e,'radar-point'));assert.equal(nodes.length,6);nodes.forEach((e,i)=>{assert.equal(e.tag,'rect');close(Number(e.attrs.x)+4,g.axes[i].point.x);close(Number(e.attrs.y)+4,g.axes[i].point.y);});
 const icons=els.filter(e=>hasClass(e,'nature-metric-icon'));assert.deepEqual(icons.map(e=>e.attrs['data-metric-key']),CAPABILITIES.map(c=>c.key));
 assert.ok(icons.every(e=>e.children.length>0&&e.children.every(p=>p.tag==='path'&&!Object.keys(p.attrs).some(k=>/href|on/.test(k)))));
 assert.deepEqual(els.filter(e=>hasClass(e,'radar-axis-label')).map(e=>e.textContent),CAPABILITIES.map(c=>c.shortLabel));
 const partial=descendants(renderRadar({axes:input.map((c,i)=>({...c,value:i===1?null:c.value})),pixelStyle:true}));assert.equal(partial.filter(e=>hasClass(e,'radar-area')).length,0);assert.equal(partial.filter(e=>hasClass(e,'radar-point')).length,5);
});
