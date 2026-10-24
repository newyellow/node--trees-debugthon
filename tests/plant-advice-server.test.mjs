import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdtemp,cp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer,createLimiter,requestIP,validateStaticUpstream,PUBLIC_ORIGIN} from '../server/plant-advice-server.mjs';
import {loadGrounding,summarizeSourceSpecies} from '../server/plant-advice-grounding.mjs';
import {createModelClient,GATEWAY_URL} from '../server/plant-advice-model.mjs';
import {validateRequest,validateModelOutput,formatResponse,boundedRetryAfter} from '../server/plant-advice-validation.mjs';
const input={villageId:'6300100002',mode:'planting',message:'請看未來願景',history:[]};
const output={answer:'這是規劃構想，請由專業人員現勘。',plants:[{name:'樟樹'}],vision:true};
const grounding={sources:[{title:'公開測試依據'}],get:async id=>{if(id!==input.villageId){const {HttpError}=await import('../server/plant-advice-validation.mjs');throw new HttpError(400,'找不到指定的里。');}return {recordCounts:{trees:734}};}};
const close=s=>new Promise(r=>{s.closeAllConnections();s.close(r);});
async function fixture(t,options={}){const s=await startServer({port:0,grounding,model:async()=>output,...options});t.after(()=>close(s));return 'http://127.0.0.1:'+s.address().port;}
const post=(base,payload=input,headers={})=>fetch(base+'/api/plant-advice',{method:'POST',headers:{origin:PUBLIC_ORIGIN,'content-type':'application/json',...headers},body:JSON.stringify(payload)});
test('strict payload, output, vision and retry contracts',()=>{
 assert.deepEqual(validateRequest({...input,conversationId:'opaque-12'}),input);
 for(const key of ['agent','model','system','tools','urls','stats','__proto__']){const v=JSON.parse(JSON.stringify(input));Object.defineProperty(v,key,{value:'x',enumerable:true});assert.throws(()=>validateRequest(v));}
 for(const v of [{...input,message:'a'.repeat(1201)},{...input,history:Array(9).fill({role:'user',content:'x'})},{...input,history:[{role:'system',content:'x'}]},{...input,history:[{role:'user',content:'x',tools:[]}]},{...input,conversationId:'../x'}])assert.throws(()=>validateRequest(v));
 for(const v of [{...output,plants:Array(5).fill({name:'x'})},{...output,sources:[]},{...output,answer:'https://evil.invalid'},{...output,vision:'true'}])assert.throws(()=>validateModelOutput(v));
 assert.equal(formatResponse(output,input,[], 'id').tour.kind,'four-region-vision');
 assert.ok(!formatResponse(output,{...input,mode:'home'},[],'id').tour);assert.ok(!formatResponse(output,{...input,message:'種什麼'},[],'id').tour);
 assert.equal(boundedRetryAfter('99999'),3600);assert.equal(boundedRetryAfter('1'),1);
});
test('real public grounding validates hash, exact source case, no raw private fields',async()=>{
 const g=await loadGrounding({root:new URL('../public',import.meta.url).pathname}),v=await g.get(input.villageId);
 assert.equal(v.recordCounts.trees,734);assert.equal(v.recordCounts.protected,9);assert.equal(v.sourceSpecies.length,14);assert.equal(v.sourceSpecies.reduce((s,v)=>s+v.count,0),734);
 assert.ok(v.demo.birdInsect.simulated);assert.ok(v.demo.activity.simulated);assert.match(v.limitations.join(''),/DEMO/);
 const text=JSON.stringify(v);for(const key of ['coordinates','TreeID','sourceIndex','discord.com','sourceImage','TreeLocation'])assert.ok(!text.includes(key));
 assert.equal(new Set(v.blueprint.regions.flatMap(r=>r.plants)).size,19);await assert.rejects(()=>g.get('unknown'),e=>e.status===400);
 assert.deepEqual(summarizeSourceSpecies([{feature:{properties:{TreeType:'台灣欒樹'}}},{feature:{properties:{TreeType:'臺灣欒樹'}}}]).map(v=>v.count),[1,1]);
});
test('tampered game bytes fail before any inference',async()=>{
 const root=await mkdtemp(join(tmpdir(),'trees-advice-'));try{await cp(new URL('../public/data',import.meta.url),join(root,'data'),{recursive:true,filter:p=>!p.endsWith('.geojson')&&!p.includes('/villages/')});await writeFile(join(root,'data/village-game.json'),'{}');await assert.rejects(()=>loadGrounding({root}));}finally{await rm(root,{recursive:true,force:true});}
});
test('model uses fixed target only and sanitizes upstream failures (mock fetch only)',async()=>{
 let request;const client=createModelClient({authLoader:async()=> 'test-only-not-a-secret',fetcher:async(url,opts)=>{request={url,opts,body:JSON.parse(opts.body)};return Response.json({choices:[{message:{content:JSON.stringify(output)}}]});}});
 assert.deepEqual(await client(input,{},new AbortController().signal),output);assert.equal(request.url,GATEWAY_URL);assert.equal(request.body.model,'openclaw/trees-plant-advisor');assert.equal(request.opts.redirect,'error');
 assert.deepEqual(Object.keys(request.body).sort(),['max_tokens','messages','model','stream','tool_choice']);assert.equal(request.body.max_tokens,1400);assert.equal(request.body.tool_choice,'none');assert.deepEqual(Object.keys(request.opts.headers).sort(),['Authorization','Content-Type']);
 for(const response of [new Response('secret raw error',{status:500}),Response.json({choices:[{message:{content:'not json'}}]}),new Response('x'.repeat(66000))]){const c=createModelClient({authLoader:async()=> 'test',fetcher:async()=>response});await assert.rejects(()=>c(input,{},new AbortController().signal),e=>e.status===502&&!e.message.includes('secret'));}
 const c=createModelClient({authLoader:async()=> 'test',fetcher:async()=>new Response('',{status:429,headers:{'retry-after':'99999'}})});await assert.rejects(()=>c(input,{},new AbortController().signal),e=>e.status===429&&e.retryAfter===3600);
});
test('HTTP success, health, origin, content type, limits and unknown routes',async t=>{
 let calls=0;const base=await fixture(t,{model:async()=>{calls++;return output;}});
 let r=await post(base);assert.equal(r.status,200);const v=await r.json();assert.deepEqual(Object.keys(v).sort(),['answer','plants','requestId','sources','tour']);assert.deepEqual(v.sources,grounding.sources);assert.equal(r.headers.get('access-control-allow-origin'),null);assert.equal(r.headers.get('set-cookie'),null);
 assert.deepEqual(await (await fetch(base+'/api/plant-advice/health')).json(),{ok:true});
 assert.equal((await post(base,input,{origin:'https://evil.invalid'})).status,403);assert.equal((await post(base,input,{origin:''})).status,403);
 assert.equal((await post(base,input,{'content-type':'text/plain'})).status,400);assert.equal((await post(base,{...input,agent:'other'})).status,400);
 assert.equal((await post(base,{...input,villageId:'unknown'})).status,400);
 assert.equal((await post(base,{...input,message:'x'.repeat(17000)})).status,413);
 for(const p of ['/v1/chat/completions','/api/unknown','/gateway','/ws'])assert.equal((await fetch(base+p)).status,404);
 assert.equal((await fetch(base+'/other',{method:'POST'})).status,405);assert.equal(calls,1);
});
test('invalid AI output remains honest 502; no fallback static answer',async t=>{const base=await fixture(t,{model:async()=>({bad:'reply'})});assert.equal((await post(base)).status,502);});
test('limiter per IP, global hour/day, no queue, expiry, bound map and trusted peer',()=>{
 let now=0;const l=createLimiter({now:()=>now,maxKeys:2});const a=l.acquire('a'),b=l.acquire('b');assert.throws(()=>l.acquire('c'),e=>e.status===503);a();b();assert.throws(()=>l.acquire('c'),e=>e.status===503);for(let i=0;i<5;i++)l.acquire('a')();assert.throws(()=>l.acquire('a'),e=>e.status===429);now=600001;l.acquire('c')();assert.equal(l.size,1);
 let time=0;const global=createLimiter({now:()=>time});for(let hour=0;hour<4;hour++){for(let i=0;i<30;i++)global.acquire(hour+'-'+i)();assert.throws(()=>global.acquire('extra'),e=>e.status===429);time+=3600000;}assert.throws(()=>global.acquire('daily'),e=>e.status===429);time=86400001;global.acquire('next')();
 assert.equal(requestIP({socket:{remoteAddress:'10.0.0.2'},headers:{'cf-connecting-ip':'8.8.8.8'}}),'10.0.0.2');assert.equal(requestIP({socket:{remoteAddress:'127.0.0.1'},headers:{'cf-connecting-ip':'8.8.8.8'}}),'8.8.8.8');
 for(const u of ['https://127.0.0.1:5175','http://evil.invalid:5175','http://127.0.0.1:18789','http://127.0.0.1:5175/v1'])assert.throws(()=>validateStaticUpstream(u));
});
test('static GET/HEAD streams exact paths and strips sensitive/hop headers across seven routes',async t=>{
 const paths=[];const staticServer=http.createServer((req,res)=>{paths.push(req.url);assert.equal(req.headers.authorization,undefined);assert.equal(req.headers.cookie,undefined);assert.equal(req.headers['cf-connecting-ip'],undefined);assert.equal(req.headers['x-openclaw-agent-id'],undefined);res.writeHead(200,{'content-type':'text/plain','set-cookie':'private=x','x-openclaw-token':'never','referrer-policy':'strict-origin-when-cross-origin','x-content-type-options':'nosniff'});res.end('static:'+req.url);});await new Promise(r=>staticServer.listen(0,'127.0.0.1',r));t.after(()=>close(staticServer));
 const base=await fixture(t,{staticUpstream:'http://127.0.0.1:'+staticServer.address().port});
 for(const p of ['/','/explorer/index.html','/stories/index.html','/stories/research/index.html','/workspaces/02/index.html','/workspaces/03/index.html','/data/manifest.json']){const r=await fetch(base+p,{headers:{authorization:'not-forwarded',cookie:'x=y','cf-connecting-ip':'8.8.8.8','x-openclaw-agent-id':'other'}});assert.equal(await r.text(),'static:'+p);assert.equal(r.headers.get('set-cookie'),null);assert.equal(r.headers.get('x-openclaw-token'),null);assert.equal(r.headers.get('referrer-policy'),'strict-origin-when-cross-origin');assert.equal(r.headers.get('x-content-type-options'),'nosniff');}
 assert.equal((await fetch(base+'/explorer/index.html',{method:'HEAD'})).status,200);assert.equal(paths.length,8);
});
test('HTTP concurrency rejects third immediately and releases after disconnect',async t=>{
 const pending=[];const base=await fixture(t,{model:(_i,_g,signal)=>new Promise((resolve,reject)=>{pending.push({resolve,signal});signal.addEventListener('abort',()=>reject(new Error('abort')),{once:true});})});
 const c=new AbortController();const p1=fetch(base+'/api/plant-advice',{method:'POST',headers:{origin:PUBLIC_ORIGIN,'content-type':'application/json'},body:JSON.stringify(input),signal:c.signal}).catch(()=>null);const p2=post(base);
 while(pending.length<2)await new Promise(r=>setTimeout(r,5));assert.equal((await post(base)).status,503);c.abort();await p1;while(!pending[0].signal.aborted)await new Promise(r=>setTimeout(r,5));pending[1].resolve(output);assert.equal((await p2).status,200);
});
test('chunked bodies enforce 16KiB with honest 413',async t=>{
 const base=await fixture(t);
 const status=await new Promise((resolve,reject)=>{const req=http.request(base+'/api/plant-advice',{method:'POST',headers:{origin:PUBLIC_ORIGIN,'content-type':'application/json','transfer-encoding':'chunked'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.write('x'.repeat(9000));req.end('x'.repeat(9000));});assert.equal(status,413);
});
test('mock inference timeout aborts and maps to sanitized 502',async()=>{
 let aborted=false;const client=createModelClient({timeoutMs:10,authLoader:async()=> 'test',fetcher:async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new Error('private debug error'));},{once:true}))});
 const keepAlive=setTimeout(()=>{},100);try{await assert.rejects(()=>client(input,{},new AbortController().signal),e=>e.status===502&&!e.message.includes('private'));assert.ok(aborted);}finally{clearTimeout(keepAlive);}
});

test('static redirects remain relative and never reveal private upstream origin',async t=>{const staticServer=http.createServer((_req,res)=>{res.writeHead(301,{location:'http://127.0.0.1:'+staticServer.address().port+'/explorer/'});res.end();});await new Promise(r=>staticServer.listen(0,'127.0.0.1',r));t.after(()=>close(staticServer));const base=await fixture(t,{staticUpstream:'http://127.0.0.1:'+staticServer.address().port});const response=await fetch(base+'/explorer',{redirect:'manual'});assert.equal(response.status,301);assert.equal(response.headers.get('location'),'/explorer/');});
