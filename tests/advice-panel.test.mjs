import test from 'node:test';
import assert from 'node:assert/strict';
import {adviceEndpoint,boundedHistory,validateAdvice,confirmedPlant,referenceCandidates,INITIAL_MESSAGES} from '../src/workspaces/02/advice-panel.js';
test('fixed origin-root proxy; prefix or arbitrary base cannot choose backend',()=>{
 for(const base of ['/','/review/','https://other.test/'])assert.equal(adviceEndpoint(base,'https://trees.test'),'https://trees.test/api/plant-advice');
 assert.match(INITIAL_MESSAGES.home,/寵物/);assert.match(INITIAL_MESSAGES.planting,/四區/);
});
test('history permits user/assistant only, eight bounded turns',()=>{
 const h=boundedHistory([{role:'system',content:'bad'},...Array.from({length:12},()=>({role:'assistant',content:'x'.repeat(7000)}))]);
 assert.equal(h.length,8);assert.equal(h[0].content.length,1200);assert.deepEqual(Object.keys(h[0]),['role','content']);
});
test('invalid answers are errors; URLs and LLM image/provider data never forwarded',()=>{
 for(const value of [{},{answer:''},{answer:'ok',plants:[],sources:null},{answer:'ok',plants:[{}],sources:[]}])assert.throws(()=>validateAdvice(value));
 const out=validateAdvice({answer:'<script>raw text</script>',plants:Array.from({length:8},()=>({name:'榕樹',image_url:'https://bad.test/image'})),sources:[{title:'bad',url:'javascript:alert(1)'}],tour:{kind:'four-region-vision'},token:'secret'});
 assert.equal(out.plants.length,4);assert.equal(out.sources[0].url,null);assert.equal(out.tour,true);assert.equal(out.token,undefined);assert.equal(out.plants[0].image_url,undefined);
});
test('photos require unique exact API identity and supplied scientific name must agree',()=>{
 const p={vernacular_name_zh:'榕樹',scientific_name:'Ficus microcarpa'},query={name:'榕樹',scientificName:'Ficus microcarpa'};
 assert.equal(confirmedPlant({plants:[p]},query),p);
 assert.equal(confirmedPlant({plants:[p,p]},query),null);assert.equal(referenceCandidates({plants:[p,{...p,scientific_name:'Camphora officinarum'}]},{name:'榕樹'}).length,2);
 assert.equal(confirmedPlant({plants:[p]},{name:'榕樹'}),p);assert.equal(confirmedPlant({plants:[p,p]},{name:'榕樹'}),null);
 assert.equal(confirmedPlant({plants:[p]},{name:'榕樹',scientificName:'Ficus benjamina'}),null);
 assert.equal(confirmedPlant({plants:[p]},{name:'小榕樹',scientificName:'Ficus microcarpa'}),null);
});
