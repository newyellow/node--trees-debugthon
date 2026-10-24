import test from 'node:test';
import assert from 'node:assert/strict';
import {SYSTEM_PROMPT,createModelClient} from '../server/plant-advice-model.mjs';
test('project exclusion policy is sent in both modes without deleting source observations or changing output flow',async()=>{
 const names=['榕樹','白千層','小葉欖仁','大花紫葳','大花紫薇','黑板樹','水黃皮','大王椰子','紫薇'];
 const start=SYSTEM_PROMPT.indexOf('本案推薦排除規則');const end=SYSTEM_PROMPT.indexOf('以下安全與依據規範',start);assert.ok(start>=0&&end>start);const rule=SYSTEM_PROMPT.slice(start,end);
 for(const name of names)assert.ok(rule.includes(name),name);
 for(const text of ['種植與居家兩模式皆適用','不得列入plants','不刪除也不否認','不因排除名單鼓勵移除','不必主動列出排除名單','不得編造','小花紫薇','推薦排除仍優先'])assert.ok(rule.includes(text),text);
 const observed={village:{name:'測試里'},sourceSpecies:[{name:'榕樹',count:5},{name:'水黃皮',count:3}]};const before=JSON.stringify(observed);
 const answer={answer:'照顧既有樹，再依場地條件考慮茄苳。',plants:[{name:'茄苳'}],vision:false};let requests=0;
 const nl=String.fromCharCode(10);const client=createModelClient({authLoader:async()=> 'mock-only',fetcher:async(url,options)=>{requests++;const payload=JSON.parse(options.body);assert.equal(payload.messages[0].content,SYSTEM_PROMPT);assert.ok(payload.messages[1].content.includes('水黃皮'));assert.equal(payload.tool_choice,'none');assert.equal(payload.stream,true);assert.equal(payload.max_tokens,750);const frame=JSON.stringify({choices:[{delta:{content:JSON.stringify(answer)}}]});return new Response('data: '+frame+nl+nl+'data: [DONE]'+nl+nl);}});
 for(const mode of ['planting','home'])assert.deepEqual(await client({mode,message:'提供建議',history:[]},observed,new AbortController().signal),answer);
 assert.equal(requests,2);assert.equal(JSON.stringify(observed),before);
});

