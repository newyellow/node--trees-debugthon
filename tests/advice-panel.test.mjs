import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedPlant,referenceCandidates} from '../src/workspaces/02/advice-panel.js';
// Live endpoint/history/response tests superseded by cached-advice.test.mjs.
test('photos require unique exact API identity and supplied scientific name must agree',()=>{
 const p={vernacular_name_zh:'榕樹',scientific_name:'Ficus microcarpa'},query={name:'榕樹',scientificName:'Ficus microcarpa'};
 assert.equal(confirmedPlant({plants:[p]},query),p);
 assert.equal(confirmedPlant({plants:[p,p]},query),null);assert.equal(referenceCandidates({plants:[p,{...p,scientific_name:'Camphora officinarum'}]},{name:'榕樹'}).length,2);
 assert.equal(confirmedPlant({plants:[p]},{name:'榕樹'}),p);assert.equal(confirmedPlant({plants:[p,p]},{name:'榕樹'}),null);
 assert.equal(confirmedPlant({plants:[p]},{name:'榕樹',scientificName:'Ficus benjamina'}),null);
 assert.equal(confirmedPlant({plants:[p]},{name:'小榕樹',scientificName:'Ficus microcarpa'}),null);
});
