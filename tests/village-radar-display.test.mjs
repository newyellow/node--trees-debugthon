import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPABILITIES,RADAR_CAPABILITIES,dominantCapability} from '../src/workspaces/02/domain.js';
test('six display capabilities retain two N/A axes without entering ranked capabilities',()=>{
 assert.equal(RADAR_CAPABILITIES.length,6);assert.equal(CAPABILITIES.length,4);
 assert.deepEqual(RADAR_CAPABILITIES.map(c=>c.emoji),['🌳','🛡️','🌿','🌱','🦋','🚶']);
 assert.equal(RADAR_CAPABILITIES.filter(c=>c.unavailable).length,2);
 for(const c of RADAR_CAPABILITIES.filter(c=>c.unavailable))assert.ok(!CAPABILITIES.some(a=>a.key===c.key));
 const scores={treeDensity:0,protectedDensity:0,richness:0,binDensity:0,nativeShare:100,birdInsect:100};assert.equal(dominantCapability(scores).kind,'neutral');
 assert.equal(dominantCapability({...scores,treeDensity:20}).keys[0],'treeDensity');
});
