import {CAPABILITIES} from './domain.js';
// Version the policy independently of source percentile scores.
export const RATING_POLICY = Object.freeze({version:'equal-six-capability-demo-mean-v1',weights:Object.freeze(Object.fromEntries(CAPABILITIES.map(c=>[c.key,1])))});
export function compositeRating(scores={}, policy=RATING_POLICY) {
 let total=0,weight=0;
 for(const {key} of CAPABILITIES){const value=scores[key],w=policy.weights[key];if(Number.isFinite(value)&&value>=0&&value<=100&&Number.isFinite(w)&&w>0){total+=value*w;weight+=w;}}
 return weight ? Math.round(total/weight/20*10)/10 : null;
}
export function unwindLevel(level){return level==='tree'?'village':'overview';}
// Five-percent margins belong to the remaining map frame, not the full viewport.
// Horizontal/sidebar clearances preserve the existing camera composition.
export function villageFitPadding(width,height,{bubble=0,bottom=0,sidebar=0}={}) {
 const usableWidth=Math.max(40,width-sidebar),top=Math.max(0,bubble),lower=Math.max(0,bottom);
 const verticalMargin=Math.max(0,height-top-lower)*.05;
 return {paddingTopLeft:[usableWidth*.1,top+verticalMargin],paddingBottomRight:[sidebar+usableWidth*.1,lower+verticalMargin]};
}
