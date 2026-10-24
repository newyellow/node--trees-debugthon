import {CAPABILITIES} from './domain.js';
// Version the policy independently of source percentile scores.
export const RATING_POLICY = Object.freeze({version:'equal-six-capability-demo-mean-v1',weights:Object.freeze(Object.fromEntries(CAPABILITIES.map(c=>[c.key,1])))});
export function compositeRating(scores={}, policy=RATING_POLICY) {
 let total=0,weight=0;
 for(const {key} of CAPABILITIES){const value=scores[key],w=policy.weights[key];if(Number.isFinite(value)&&value>=0&&value<=100&&Number.isFinite(w)&&w>0){total+=value*w;weight+=w;}}
 return weight ? Math.round(total/weight/20*10)/10 : null;
}
export function unwindLevel(level){return level==='tree'?'village':'overview';}
// Reserve a fixed bubble band above the ENTIRE geometry, then 10% breathing
// room on each side. Fractional zoom fits long thin / multipart geometries.
export function villageFitPadding(width,height,{toolbar=120,bubble=280,sidebar=0,bottom=32}={}) {
 const usableWidth=Math.max(40,width-sidebar), usableHeight=Math.max(40,height-toolbar-bubble-bottom);
 return {paddingTopLeft:[usableWidth*.1,toolbar+bubble+usableHeight*.1],paddingBottomRight:[sidebar+usableWidth*.1,bottom+usableHeight*.1]};
}
