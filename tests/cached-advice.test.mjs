import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CACHED_ADVICE_VERSION as version,cachedAdviceURL,validateCachedAdvice,loadCachedAdvice,playCachedAnswer} from '../src/workspaces/02/cached-advice.js';
import {createAdvicePanel,INITIAL_MESSAGES} from '../src/workspaces/02/advice-panel.js';
const selection={villageId:'v1',mode:'planting',origin:'https://trees.test',base:'/review/'};
const advice=()=>({answer:'種樹🌳，一起照顧。',plants:[],sources:[{title:'來源',url:'https://example.org/ref'}]});
const shard=(id='v1')=>({schemaVersion:1,version,villageId:id,modes:{planting:{...advice(),tour:{kind:'four-region-vision'}},home:advice()}});
test('same-origin prefix path and pinned version; invalid selections never fetch',async()=>{
 const u=new URL(cachedAdviceURL(selection));assert.equal(u.pathname,'/review/data/precomputed-advice/v1.json');assert.equal(u.searchParams.get('v'),version);
 for(const patch of [{base:'https://evil.test/'},{base:'/review'},{villageId:'../v1'},{mode:'chat'}])assert.throws(()=>cachedAdviceURL({...selection,...patch}));
 let calls=0;await assert.rejects(loadCachedAdvice({...selection,mode:'bad',fetcher:()=>{calls++;}}));assert.equal(calls,0);
 assert.ok(INITIAL_MESSAGES.home);assert.equal(typeof createAdvicePanel,'function');
});
test('strict village/mode/version/schema and safe source URLs; cached images/details discarded',()=>{
 const valid=shard();valid.modes.planting.plants=[{name:'榕樹',scientificName:'Ficus microcarpa',image_url:'https://bad.test',description:'cached forbidden'}];
 const out=validateCachedAdvice(valid,selection);assert.equal(out.tour,true);assert.deepEqual(Object.keys(out.plants[0]),['name','scientificName']);assert.equal(validateCachedAdvice(valid,{...selection,mode:'home'}).tour,false);
 for(const mutate of [x=>x.version='old',x=>x.villageId='v2',x=>x.schemaVersion=2,x=>delete x.modes.planting,x=>x.modes.planting.answer='',x=>x.modes.planting.sources[0].url='javascript:alert(1)',x=>x.modes.planting.sources[0].url='http://example.org',x=>x.modes.planting.sources[0].url='https://u:p@example.org']){const x=shard();mutate(x);assert.throws(()=>validateCachedAdvice(x,selection));}
 const home=shard();home.modes.home.tour={kind:'four-region-vision'};assert.throws(()=>validateCachedAdvice(home,{...selection,mode:'home'}));
});
test('loader aborts and rejects stale response/json even when transport ignores abort',async()=>{
 const ac=new AbortController();ac.abort();let calls=0;await assert.rejects(loadCachedAdvice({...selection,signal:ac.signal,fetcher:()=>calls++}),{name:'AbortError'});assert.equal(calls,0);
 let finish;let current=true;const p=loadCachedAdvice({...selection,isCurrent:()=>current,fetcher:()=>new Promise(r=>finish=r)});current=false;finish({ok:true,json:async()=>shard()});await assert.rejects(p,{name:'AbortError'});
 const a=new AbortController();await assert.rejects(loadCachedAdvice({...selection,signal:a.signal,fetcher:async()=>({ok:true,json:async()=>{a.abort();return shard();}})}),{name:'AbortError'});
});
test('local letter playback, Unicode, reduced motion, cancellation, stale tokens',async()=>{
 const texts=[];await playCachedAnswer('甲🌳乙',{interval:0,onText:t=>texts.push(t)});assert.deepEqual(texts,['甲','甲🌳','甲🌳乙']);
 const instant=[];await playCachedAnswer('完整',{reducedMotion:true,onText:t=>instant.push(t)});assert.deepEqual(instant,['完整']);
 const a=new AbortController(),partial=[];const p=playCachedAnswer('不能繼續',{signal:a.signal,interval:100,onText:t=>partial.push(t)});a.abort();await assert.rejects(p,{name:'AbortError'});assert.deepEqual(partial,['不']);
 let current=true;const stale=[];await assert.rejects(playCachedAnswer('舊里別',{isCurrent:()=>current,onText:t=>{stale.push(t);current=false;},interval:0}),{name:'AbortError'});assert.deepEqual(stale,['舊']);
});
// Tiny DOM harness: all network paths are spied, not connected to real services.
class Node {
 constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.hidden=false;this.textContent='';this.isConnected=true;}
 append(...nodes){for(const n of nodes){if(typeof n==='object'){n.parent=this;this.children.push(n);}}}
 setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}
 addEventListener(){}focus(){}remove(){this.parent?.children.splice(this.parent.children.indexOf(this),1);}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 after(node){node.parent=this.parent;this.parent.children.splice(this.parent.children.indexOf(this)+1,0,node);}
 querySelectorAll(selector){const all=this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);if(selector==='*')return all;return all.filter(n=>n.className?.split(' ').includes('advice-answer')&&Object.hasOwn(n.attrs,'aria-hidden'));}
}
const find=(n,p)=>[n,...n.querySelectorAll('*')].filter(p);
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
test('panel inference-spy: read/retry/error/cancel/switch/close/reopen are GET static only; no inputs; structured planting tour only',async()=>{
 const oldDoc=globalThis.document,oldLocation=globalThis.location;globalThis.document={createElement:tag=>new Node(tag),activeElement:null};globalThis.location={origin:'https://trees.test'};
 try{
  const container=new Node('main'),calls=[];let held,fail=false,hold=false,visions=0,cancels=0,completeTour;
  const fetcher=async(url,options)=>{calls.push({url,options});assert.equal(options.method,'GET');assert.equal(new URL(url).pathname.startsWith('/review/data/precomputed-advice/'),true);assert.equal(options.body,undefined);if(hold){hold=false;return new Promise(r=>held=r);}if(fail){fail=false;return {ok:false};}const id=new URL(url).pathname.split('/').at(-1).replace('.json','');return {ok:true,json:async()=>shard(id)};};
  const panel=createAdvicePanel({container,base:'/review/',fetcher,media:{matches:true},onVision:()=>{visions++;return {finished:new Promise(r=>completeTour=r),cancel:()=>{cancels++;completeTour();}};}});
  const open=(mode='home',id='v1')=>panel.open({village:{id,name:id,district:'測試區'},mode});const root=container.children[0];
  open();await settle();assert.equal(root.dataset.phase,'ready');assert.equal(find(root,n=>['form','input','textarea'].includes(n.tagName)).length,0);assert.equal(find(root,n=>n.className==='advice-ai-quote').length,1);assert.equal(visions,0);
  const retry=find(root,n=>n.tagName==='button'&&n.textContent==='重新讀取')[0];retry.onclick();await settle();assert.equal(calls.length,2);assert.equal(find(root,n=>n.className==='advice-ai-quote').length,1);
  fail=true;open();await settle();assert.equal(root.dataset.phase,'error');retry.onclick();await settle();assert.equal(root.dataset.phase,'ready');
  hold=true;open('planting');await settle();const staleCall=calls.at(-1);open('home','v2');await settle();held({ok:true,json:async()=>shard()});await settle();assert.equal(staleCall.options.signal.aborted,true);assert.equal(root.dataset.villageId,'v2');assert.equal(root.dataset.phase,'ready');assert.equal(visions,0);
  hold=true;open();await settle();panel.cancel();assert.equal(root.dataset.phase,'cancelled');assert.equal(calls.at(-1).options.signal.aborted,true);held({ok:true,json:async()=>shard()});await settle();assert.equal(root.dataset.phase,'cancelled');
  hold=true;open();await settle();panel.close();held({ok:true,json:async()=>shard()});await settle();assert.equal(panel.isOpen(),false);open();await settle();assert.equal(root.dataset.phase,'ready');panel.destroy();
  const tourPanel=createAdvicePanel({container,base:'/review/',fetcher,media:{matches:false},onVision:()=>{visions++;return {finished:new Promise(r=>completeTour=r),cancel:()=>{cancels++;completeTour();}};}});tourPanel.open({village:{id:'v1'},mode:'planting'});await settle();assert.equal(visions,1);tourPanel.open({village:{id:'v2'},mode:'home'});await settle();assert.equal(cancels,1);assert.equal(visions,1);tourPanel.close();await settle();
  assert.equal(calls.some(c=>c.url.includes('/api/plant-advice')||c.options.method==='POST'),false);
 }finally{globalThis.document=oldDoc;globalThis.location=oldLocation;}
});
test('production reading modules have no live inference imports, endpoint, chat composer or history',async()=>{
 const panel=await readFile(new URL('../src/workspaces/02/advice-panel.js',import.meta.url),'utf8');const loader=await readFile(new URL('../src/workspaces/02/cached-advice.js',import.meta.url),'utf8');
 for(const src of [panel,loader])for(const forbidden of ['advice-stream','readAdviceStream','/api/plant-advice',"method:'POST'","el('form'","el('textarea'","el('input'",'boundedHistory'])assert.equal(src.includes(forbidden),false,forbidden);
 assert.match(panel,/預生成建議・逐字播放/);assert.ok(panel.includes("appendPlantDetails(section,p)"));assert.match(panel,/figures.attach/);
});
