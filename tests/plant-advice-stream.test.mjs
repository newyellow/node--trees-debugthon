import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnswerExtractor,consumeSSE} from '../server/plant-advice-stream.mjs';
import {createModelClient} from '../server/plant-advice-model.mjs';
import {startServer,createLimiter,PUBLIC_ORIGIN} from '../server/plant-advice-server.mjs';
const encoder=new TextEncoder();
const input={villageId:'test',mode:'home',message:'種什麼',history:[]};
const output={answer:'先觀察日照。再選擇植物。',plants:[{name:'樟樹'}],vision:false};
const event=content=>'data: '+JSON.stringify({choices:[{index:0,delta:{content}}]})+'\n\n';
const done='data: [DONE]\n\n';
const signal=()=>new AbortController().signal;
const response=text=>new Response(text,{headers:{'content-type':'text/event-stream'}});
const client=fetcher=>createModelClient({fetcher,authLoader:async()=> 'mock-only'});
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
const grounding={sources:[{title:'測試'}],get:async()=>({})};
async function fixture(t,model,limiter=createLimiter()) {
 const server=await startServer({port:0,grounding,model,limiter});
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 return {base:'http://127.0.0.1:'+server.address().port,limiter};
}
const post=(base,extra={})=>fetch(base+'/api/plant-advice',{method:'POST',headers:{origin:PUBLIC_ORIGIN,'content-type':'application/json',accept:'application/x-ndjson'},body:JSON.stringify(input),...extra});
async function lines(reader) {let text='';while(true){const {value,done}=await reader.read();if(done)break;text+=new TextDecoder().decode(value);}return text.trim().split('\n').filter(Boolean).map(JSON.parse);}

test('root answer extraction decodes split escapes and unicode and ignores nested envelope fields',async()=>{
 const text='觀察🌳。換行\n引號"與斜線\\。';
 const raw=JSON.stringify({plants:[{name:'測試',scientificName:'not answer'}],answer:text,vision:false}).replace('🌳','\\ud83c\\udf33');
 const deltas=[],extractor=createAnswerExtractor(async s=>deltas.push(s));
 for(const c of raw.split(''))await extractor.push(c);
 assert.equal(extractor.finish().answer,text);assert.equal(deltas.join(''),text);assert.ok(deltas.every(v=>v.isWellFormed()));
});

test('genuine model SSE first decoded answer delta arrives before upstream completion',async()=>{
 const first=deferred(),finish=deferred();let completed=false,request;
 const model=client(async(_url,options)=>{
  request=JSON.parse(options.body);
  return new Response(new ReadableStream({async start(controller){
   controller.enqueue(encoder.encode(event('{"answer":"先觀察日照。')));
   await finish.promise;completed=true;
   controller.enqueue(encoder.encode(event('再選擇植物。","plants":[],"vision":false}')+done));controller.close();
  }}));
 });
 const deltas=[];const pending=model(input,{},signal(),async text=>{deltas.push(text);first.resolve();});
 await first.promise;assert.equal(completed,false);assert.equal(deltas.join(''),'先觀察日照。');assert.equal(request.stream,true);
 finish.resolve();const result=await pending;assert.equal(result.answer,deltas.join(''));
});

test('SSE UTF8 decoder handles every byte boundary, CRLF and JSON unicode escapes',async()=>{
 const source=event(JSON.stringify({...output,answer:'你好🌳。'})).replaceAll('\n','\r\n')+done;
 const bytes=encoder.encode(source);
 const body=new ReadableStream({start(c){for(const b of bytes)c.enqueue(Uint8Array.of(b));c.close();}});
 const extractor=createAnswerExtractor();await consumeSSE(body,signal(),s=>extractor.push(s));assert.equal(extractor.finish().answer,'你好🌳。');
});

test('model async onDelta applies upstream backpressure',async()=>{
 const gate=deferred(),first=deferred();let callbacks=0;
 const model=client(async()=>response(event(JSON.stringify(output))+done));
 const pending=model(input,{},signal(),async()=>{callbacks++;first.resolve();await gate.promise;});
 await first.promise;assert.equal(callbacks,1);gate.resolve();assert.equal((await pending).answer,output.answer);assert.equal(callbacks,2);
});

test('malformed, oversize, interrupted and private upstream errors are sanitized',async()=>{
 const bad=[event('{"answer":"x"'),event(JSON.stringify(output)),event('{"answer":"x","plants":[],"vision":true}')+'data: {"error":{"message":"PRIVATE"}}\n\n'+done,
 'data: '+ 'x'.repeat(65536)+'\n\n',event(JSON.stringify({...output,answer:'x'.repeat(6001)}))+done,
 event(JSON.stringify(output))+'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n'+done,
 'data: not-json\n\n'+done,
 event(JSON.stringify({...output,answer:'PRIVATE https://evil.invalid。'}))+done,
 event(JSON.stringify({...output,answer:'原始'+String.fromCharCode(96).repeat(3)+'code。'}))+done,
 event('{"answer":"\\ud800。","plants":[],"vision":false}')+done];
 for(const raw of bad){await assert.rejects(()=>client(async()=>response(raw))(input,{},signal()),e=>e.status===502&&!/PRIVATE|evil|code/.test(e.message));}
 const c=client(async()=>new Response('PRIVATE',{status:429,headers:{'retry-after':'999999'}}));
 await assert.rejects(()=>c(input,{},signal()),e=>e.status===429&&e.retryAfter===3600);
});

test('URL/code prefixes split across model deltas never escape',async()=>{
 for(const unsafe of ['https://evil.invalid','www.evil.invalid','<script>','data:text/plain','javascript:alert(1)',String.fromCharCode(96).repeat(3)+'js']){
  const deltas=[];const raw='{"answer":"安全。'+unsafe+'。","plants":[],"vision":false}';
  const chunks=raw.split('').map(event).join('')+done;
  await assert.rejects(()=>client(async()=>response(chunks))(input,{},signal(),async s=>deltas.push(s)));
  assert.equal(deltas.join(''),'安全。');
 }
});

test.skip('LEGACY live HTTP (replaced by precomputed-advice-server tests): HTTP negotiated NDJSON streams before completion and final structured metadata matches deltas',async t=>{
 const finish=deferred();let complete=false;
 const model=client(async()=>new Response(new ReadableStream({async start(c){
  c.enqueue(encoder.encode(event('{"answer":"先觀察日照。')));await finish.promise;complete=true;
  c.enqueue(encoder.encode(event('再選擇植物。","plants":[{"name":"樟樹"}],"vision":false}')+done));c.close();
 }})));
 const {base}=await fixture(t,model);const r=await post(base);
 assert.match(r.headers.get('content-type'),/application\/x-ndjson/);assert.match(r.headers.get('cache-control'),/no-transform/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 const reader=r.body.getReader();const first=new TextDecoder().decode((await reader.read()).value).trim().split('\n').map(JSON.parse);
 assert.equal(first[0].type,'delta');assert.equal(complete,false);assert.equal(first.map(v=>v.text||'').join(''),'先觀察日照。');
 finish.resolve();const rest=await lines(reader),all=[...first,...rest];const final=all.at(-1);
 assert.equal(final.type,'done');assert.equal(final.answer,all.filter(v=>v.type==='delta').map(v=>v.text).join(''));assert.deepEqual(final.plants,output.plants);assert.deepEqual(final.sources,grounding.sources);
});

test.skip('LEGACY live HTTP (replaced by precomputed-advice-server tests): post-delta upstream failure emits sanitized error, not done',async t=>{
 const {base}=await fixture(t,client(async()=>response(event('{"answer":"安全。')+'data: {"error":{"message":"PRIVATE"}}\n\n'+done)));
 const events=(await (await post(base)).text()).trim().split('\n').map(JSON.parse);
 assert.equal(events[0].type,'delta');assert.equal(events.at(-1).type,'error');assert.ok(!JSON.stringify(events).includes('PRIVATE'));assert.ok(!events.some(v=>v.type==='done'));
});

test.skip('LEGACY live HTTP (replaced by precomputed-advice-server tests): pre-stream 429 retains status and Retry-After; JSON callers still get structured fallback',async t=>{
 let busy=true;const {base}=await fixture(t,client(async()=>busy?new Response('private',{status:429,headers:{'retry-after':'12'}}):response(event(JSON.stringify(output))+done)));
 const r=await post(base);assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'12');assert.ok(!(await r.text()).includes('private'));
 busy=false;const r2=await fetch(base+'/api/plant-advice',{method:'POST',headers:{origin:PUBLIC_ORIGIN,'content-type':'application/json'},body:JSON.stringify(input)});assert.equal(r2.status,200);assert.equal((await r2.json()).answer,output.answer);
});

test.skip('LEGACY live HTTP (replaced by precomputed-advice-server tests): disconnect cancels actual upstream reader and frees admission without queue',async t=>{
 const cancelled=deferred();let activeSignal;
 const model=client(async(_url,{signal:s})=>{activeSignal=s;return new Response(new ReadableStream({start(c){c.enqueue(encoder.encode(event('{"answer":"先觀察。')));},cancel(){cancelled.resolve();}}));});
 const {base,limiter}=await fixture(t,model);
 const abort=new AbortController();const r=await post(base,{signal:abort.signal});await r.body.getReader().read();assert.equal(limiter.active,1);
 abort.abort();await cancelled.promise;
 assert.equal(activeSignal.aborted,true);
 // Cancellation dispatch and handler finally are bounded to the current event loop.
 await new Promise(r=>setImmediate(r));assert.equal(limiter.active,0);
});

test('timeout while reading upstream SSE cancels reader and sanitizes output',async()=>{
 let cancelled=false;
 const model=createModelClient({timeoutMs:20,authLoader:async()=> 'mock',fetcher:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}))});
 const keepAlive=setTimeout(()=>{},100);
 try{await assert.rejects(()=>model(input,{},signal()),e=>e.status===502);assert.equal(cancelled,true);}finally{clearTimeout(keepAlive);}
});

test('DONE terminates promptly without waiting for upstream EOF',async()=>{
 let cancelled=false;
 const model=client(async()=>new Response(new ReadableStream({start(c){c.enqueue(encoder.encode(event(JSON.stringify(output))+done));},cancel(){cancelled=true;}})));
 assert.equal((await model(input,{},signal())).answer,output.answer);assert.equal(cancelled,true);
});

test('concise friendly prompt retains safety and limits generation tokens',async()=>{
 const {SYSTEM_PROMPT}=await import('../server/plant-advice-model.mjs');
 for(const phrase of ['120至180','植物朋友','2至3種','明亮陽台','明亮散射光','不追加問題或聊天邀請','不可信資料','不可由里資料推定真實住家','居家vision一律false','首次回覆先依所選里','不要先要求填答或連續盤問','非官方政策','公共土地','未核實參考'])assert.ok(SYSTEM_PROMPT.includes(phrase),phrase);
 let request;await client(async(_url,opts)=>{request=JSON.parse(opts.body);return response(event(JSON.stringify(output))+done);})(input,{},signal());assert.equal(request.max_tokens,750);assert.equal(request.tool_choice,'none');
});
