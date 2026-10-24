import test from 'node:test';
import assert from 'node:assert/strict';
import {compositeRating,RATING_POLICY,villageFitPadding,unwindLevel} from '../src/workspaces/02/social-state.js';
import {readFile} from 'node:fs/promises';
test('versioned equal three-axis mean, partial NA and actual zero',()=>{
 assert.equal(compositeRating({treeDensity:100,protectedDensity:50,richness:0}),2.5);
 assert.equal(compositeRating({treeDensity:100,protectedDensity:null,richness:0}),2.5);
 assert.equal(compositeRating({treeDensity:0}),0);assert.equal(compositeRating({}),null);
 assert.equal(compositeRating({treeDensity:101,richness:-1,protectedDensity:NaN}),null);
 assert.equal(compositeRating({treeDensity:100,richness:0},{weights:{treeDensity:3,richness:1}}),3.8);
 assert.deepEqual(Object.keys(RATING_POLICY.weights),['treeDensity','protectedDensity','richness']);assert.ok(Object.isFrozen(RATING_POLICY.weights));
});
test('real456 snapshot stars remain independently reproducible',async()=>{
 const {villages}=JSON.parse(await readFile(new URL('../public/data/village-game.json',import.meta.url)));
 for(const v of villages)assert.equal(compositeRating(v.scores),Math.round((v.scores.treeDensity+v.scores.protectedDensity+v.scores.richness)/3/20*10)/10);
 assert.equal(villages.filter(v=>compositeRating(v.scores)===0).length,10);
});
test('one level unwind and responsive 80% geometry reservation',()=>{
 assert.equal(unwindLevel('tree'),'village');assert.equal(unwindLevel('village'),'overview');
 for(const [width,height,sidebar]of [[1440,1000,360],[390,844,168],[667,375,285]]){
 const p=villageFitPadding(width,height,{bubble:160,toolbar:115,sidebar});assert.ok(p.paddingTopLeft[0]>0);assert.ok(p.paddingTopLeft[1]>=275);assert.ok(p.paddingBottomRight[0]>sidebar);assert.ok(p.paddingBottomRight[1]>32);
 }
});
