import {CAPABILITIES} from './domain.js';
// Version the policy independently of source percentile scores.
export const RATING_POLICY = Object.freeze({version:'equal-six-capability-demo-mean-v1',weights:Object.freeze(Object.fromEntries(CAPABILITIES.map(c=>[c.key,1])))});
export function compositeRating(scores={}, policy=RATING_POLICY) {
 let total=0,weight=0;
 for(const {key} of CAPABILITIES){const value=scores[key],w=policy.weights[key];if(Number.isFinite(value)&&value>=0&&value<=100&&Number.isFinite(w)&&w>0){total+=value*w;weight+=w;}}
 return weight ? Math.round(total/weight/20*10)/10 : null;
}
export function unwindLevel(level){return level==='tree'?'village':'overview';}
// Fit the north bubble plus village within a 5% top/bottom frame.
// Toolbar chrome is not reserved again; horizontal/sidebar clearance is retained.
export function villageFitPadding(width,height,{bubble=0,sidebar=0}={}) {
 const usableWidth=Math.max(40,width-sidebar), verticalMargin=height*.05;
 return {paddingTopLeft:[usableWidth*.1,bubble+verticalMargin],paddingBottomRight:[sidebar+usableWidth*.1,verticalMargin]};
}
