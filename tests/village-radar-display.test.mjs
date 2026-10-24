import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPABILITIES,RADAR_CAPABILITIES,dominantCapability} from '../src/workspaces/02/domain.js';
test('six scored axes expose proxy/demo metadata and join dominance',()=>{
 assert.equal(CAPABILITIES.length,6);assert.equal(RADAR_CAPABILITIES,CAPABILITIES);
 assert.deepEqual(CAPABILITIES.map(c=>c.key),['treeDensity','protectedDensity','richness','nativeShare','birdInsect','activity']);
 assert.deepEqual(CAPABILITIES.map(c=>c.emoji),['🌳','🛡️','🌿','🌱','🦋','📣']);
 assert.equal(CAPABILITIES.filter(c=>c.unavailable).length,0);
 assert.equal(CAPABILITIES[3].proxy,true);assert.match(CAPABILITIES[3].label,/PROXY/);
 for(const c of CAPABILITIES.slice(4)){assert.equal(c.simulated,true);assert.match(c.label,/DEMO/);}
 const scores={treeDensity:0,protectedDensity:0,richness:0,nativeShare:100,birdInsect:100,activity:0};
 assert.deepEqual(dominantCapability(scores).keys,['nativeShare','birdInsect']);
 assert.deepEqual(dominantCapability({...scores,activity:100}).keys,['nativeShare','birdInsect','activity']);
 for(const c of CAPABILITIES)assert.equal(dominantCapability({[c.key]:100}).keys[0],c.key);
 assert.equal(dominantCapability(Object.fromEntries(CAPABILITIES.map(c=>[c.key,0]))).kind,'neutral');
});
