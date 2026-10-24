// Explicit opt-in only: at most two real inference requests, no provider credentials.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
if(process.env.ADVICE_LIVE_CONFIRM!=='1')throw Error('Live inference check requires ADVICE_LIVE_CONFIRM=1');
const endpoint=new URL(process.env.ADVICE_API_URL||'http://127.0.0.1:5217/api/plant-advice');if(!['http://127.0.0.1:5217','https://trees.piyellowclaw.xyz'].includes(endpoint.origin)||endpoint.pathname!=='/api/plant-advice')throw Error('Unsupported advice verification origin');
const game=JSON.parse(await readFile(new URL('../public/data/village-game.json',import.meta.url))),v=game.villages.find(v=>v.name==='龍安里'&&v.district==='大安區');
const proof=[];for(const mode of ['home','planting']){
 const message=mode==='home'?'我家陽台每天上午直射3小時，有貓。請用100字以內詢問還缺哪些條件，先不要推薦品種。':'請用250字以內清楚指出所選里名與管理樹筆數，依樹木來源名稱分布解說四區綠網未來願景。只列一種候選，強調構想與現地適種仍須覆核。';
 const response=await fetch(endpoint,{method:'POST',headers:{Origin:endpoint.origin,'Content-Type':'application/json'},body:JSON.stringify({villageId:v.id,mode,message,history:[]}),signal:AbortSignal.timeout(55000)});const result=await response.json();assert.equal(response.status,200,JSON.stringify({mode,error:result.error}));assert.ok(result.answer?.length>0);assert.ok(Array.isArray(result.sources)&&result.sources.length>0);if(mode==='home')assert.equal(result.tour,undefined);else assert.equal(result.tour?.kind,'four-region-vision');proof.push({mode,village:v.name,actualTreeRecords:v.trees,answer:result.answer,plants:result.plants,tour:result.tour,requestId:result.requestId});
}
await mkdir(new URL('../test-results/advice-integration/',import.meta.url),{recursive:true});await writeFile(new URL('../test-results/advice-integration/live-proof.json',import.meta.url),JSON.stringify(proof,null,2));console.log(JSON.stringify({passed:true,realInferenceRequests:2,modes:proof.map(p=>p.mode),plantingTour:proof[1].tour?.kind,homeTour:false,proof:'test-results/advice-integration/live-proof.json'}));
