import test from 'node:test';
import assert from 'node:assert/strict';
import {treeSpecies,treeSpeciesColor,speciesEntries} from '../src/workspaces/02/tree-species.js';
const f=(TreeType,layerId)=>({properties:{TreeType},layerId});
test('source TreeType colors normalize across sources without modifying fields',()=>{
 const a=f(' 榕樹　','street-trees'),b=f('榕樹','park-trees'),before=JSON.stringify(a);
 assert.equal(treeSpeciesColor(a),treeSpeciesColor(b));assert.notEqual(treeSpeciesColor(a),treeSpeciesColor(f('樟樹')));assert.equal(JSON.stringify(a),before);
 assert.equal(treeSpecies(f('Ａ　Ｂ')),'A B');assert.equal(treeSpeciesColor(f('未知')),'#767b80');assert.equal(treeSpeciesColor(f('枯木')),'#767b80');assert.equal(treeSpeciesColor(f(null)),'#767b80');
 assert.equal(treeSpeciesColor(f('任意來源名稱')),treeSpeciesColor(f(' 任意來源名稱 ')));
 const entries=speciesEntries([a,b,f('樟樹'),f(null)]);assert.equal(entries[0].name,'榕樹');assert.equal(entries[0].count,2);assert.equal(entries.reduce((n,e)=>n+e.count,0),4);
});
