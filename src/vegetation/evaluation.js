// Local evaluation only: no inference, downloads or geometry changes.
const ignored = new Set(['nodata', 'unknown', 'materialUnknown', 'shadowUnknown']);
const ratio = (a,b) => b === 0 ? null : a/b;
function checkClasses(classes) {
 if (!Array.isArray(classes) || !classes.length || new Set(classes).size !== classes.length || classes.some(c => typeof c !== 'string' || !c || ignored.has(c))) throw Error('unique known class names required');
}
function decode(value, mapping, classes) {
 if (value == null) return null;
 const label = mapping ? (Object.hasOwn(mapping,String(value)) ? mapping[String(value)] : null) : value;
 return classes.includes(label) ? label : null;
}
export function summarizeCounts({TP,FP,FN,TN,truthAreaM2,predictedAreaM2}) {
 return {TP,FP,FN,TN,precision:ratio(TP,TP+FP),recall:ratio(TP,TP+FN),F1:ratio(2*TP,2*TP+FP+FN),IoU:ratio(TP,TP+FP+FN),truthAreaM2,predictedAreaM2,
 signedRelativeAreaError:ratio(predictedAreaM2-truthAreaM2,truthAreaM2),relativeAreaError:ratio(Math.abs(predictedAreaM2-truthAreaM2),truthAreaM2)};
}
export function evaluateMasks({truth,prediction,classes,truthMapping,predictionMapping,validMask,pixelAreaM2=1}) {
 checkClasses(classes);
 if (!truth || !prediction || truth.length!==prediction.length) throw Error('aligned arrays required');
 if (validMask && validMask.length!==truth.length) throw Error('validMask length mismatch');
 const weighted=typeof pixelAreaM2!=='number';
 if (weighted && (!pixelAreaM2 || pixelAreaM2.length!==truth.length)) throw Error('pixel area length mismatch');
 if (!weighted && (!Number.isFinite(pixelAreaM2)||pixelAreaM2<=0)) throw Error('positive finite pixel area required');
 const confusion=classes.map(()=>classes.map(()=>0)), areas=classes.map(()=>({truth:0,predicted:0}));
 const excluded={invalidMask:0,unknownTruth:0,unknownPrediction:0}; let evaluatedPixels=0;
 for(let i=0;i<truth.length;i++) {
  const a=weighted?pixelAreaM2[i]:pixelAreaM2;
  if(!Number.isFinite(a)||a<=0) throw Error('positive finite pixel area required');
  if(validMask && ![true,false,0,1].includes(validMask[i])) throw Error('validMask must contain booleans or 0/1');
  if(validMask && !validMask[i]) {excluded.invalidMask++;continue;}
  const t=decode(truth[i],truthMapping,classes),p=decode(prediction[i],predictionMapping,classes);
  if(t===null){excluded.unknownTruth++;continue;} if(p===null){excluded.unknownPrediction++;continue;}
  const ti=classes.indexOf(t),pi=classes.indexOf(p);confusion[ti][pi]++;areas[ti].truth+=a;areas[pi].predicted+=a;evaluatedPixels++;
 }
 const perClass=Object.fromEntries(classes.map((c,k)=>{
  const TP=confusion[k][k],FN=confusion[k].reduce((a,b)=>a+b,0)-TP,FP=confusion.reduce((s,r)=>s+r[k],0)-TP;
  return [c,summarizeCounts({TP,FP,FN,TN:evaluatedPixels-TP-FP-FN,truthAreaM2:areas[k].truth,predictedAreaM2:areas[k].predicted})];
 }));
 return {classes,confusion,matrixOrder:'rows=truth; columns=prediction',totalPixels:truth.length,evaluatedPixels,evaluatedFraction:ratio(evaluatedPixels,truth.length),excluded,perClass};
}
export function poolEvaluations(reports) {
 if(!reports.length) throw Error('at least one report required'); const classes=reports[0].classes;
 if(reports.some(r=>JSON.stringify(r.classes)!==JSON.stringify(classes))) throw Error('class order mismatch');
 const sum=fn=>reports.reduce((n,r)=>n+fn(r),0),totalPixels=sum(r=>r.totalPixels),evaluatedPixels=sum(r=>r.evaluatedPixels);
 return {classes,matrixOrder:reports[0].matrixOrder,confusion:classes.map((_,i)=>classes.map((_,j)=>sum(r=>r.confusion[i][j]))),totalPixels,evaluatedPixels,evaluatedFraction:ratio(evaluatedPixels,totalPixels),
 excluded:Object.fromEntries(Object.keys(reports[0].excluded).map(k=>[k,sum(r=>r.excluded[k])])),
 perClass:Object.fromEntries(classes.map(c=>[c,summarizeCounts(Object.fromEntries(['TP','FP','FN','TN','truthAreaM2','predictedAreaM2'].map(k=>[k,sum(r=>r.perClass[c][k])])))]))};
}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
export function blockedHoldout(tiles,{seed='cached12-v1',embargoEdges=[]}={}) {
 const blocks=new Map(),ids=new Set();
 for(const t of tiles){
  if(typeof t.id!=='string'||!t.id||ids.has(t.id)||typeof t.block!=='string'||!t.block||typeof t.stratum!=='string'||!t.stratum)throw Error('unique tile id, block and stratum required');
  ids.add(t.id);if(!blocks.has(t.block))blocks.set(t.block,{stratum:t.stratum,ids:[]});const b=blocks.get(t.block);
  if(b.stratum!==t.stratum)throw Error('one stratum per block required');b.ids.push(t.id);
 }
 const assignment=new Map();
 for(const stratum of [...new Set([...blocks.values()].map(b=>b.stratum))].sort()){
  const keys=[...blocks.keys()].filter(k=>blocks.get(k).stratum===stratum).sort((a,b)=>hash(seed+':'+a)-hash(seed+':'+b)||(a<b?-1:a>b?1:0));
  if(keys.length<3)throw Error('each stratum needs at least three independent blocks');
  keys.forEach((k,i)=>assignment.set(k,['test','validation','train'][i%3]));
 }
 const priority={train:0,validation:1,test:2},buffered=new Set();
 for(const [a,b] of embargoEdges){
  if(!blocks.has(a)||!blocks.has(b)||a===b)throw Error('embargo edges require distinct known blocks');
  if(assignment.get(a)!==assignment.get(b))buffered.add(priority[assignment.get(a)]<priority[assignment.get(b)]?a:b);
 }
 const out={seed,train:[],validation:[],test:[],buffer:[]};for(const [k,b]of blocks)out[buffered.has(k)?'buffer':assignment.get(k)].push(...b.ids);
 for(const k of ['train','validation','test','buffer'])out[k].sort();
 if(['train','validation','test'].some(k=>!out[k].length))throw Error('insufficient independent blocks after embargo; no held-out accuracy');return out;
}
export const CACHED12_TILE_IDS=Object.freeze(Array.from({length:3},(_,y)=>Array.from({length:4},(_,x)=>'19/'+(224446+y)+'/'+(439181+x))).flat());
export function evaluatePilot(input){
 const {tiles,classes,truthMapping,predictionMappings}=input;checkClasses(classes);
 if(!Array.isArray(tiles)||tiles.length!==12||new Set(tiles.map(t=>t.id)).size!==12||tiles.some(t=>!CACHED12_TILE_IDS.includes(t.id)))throw Error('exact cached12 pilot tile IDs required');
 const models=Object.keys(predictionMappings||{}).sort();if(!models.length)throw Error('predictionMappings required');
 const reports=Object.fromEntries(models.map(m=>[m,{pre:[],post:[]}])),support=[];
 for(const t of [...tiles].sort((a,b)=>a.id.localeCompare(b.id))){
  const n=256*256;
  if(t.width!==256||t.height!==256||!Array.isArray(t.truth)||t.truth.length!==n||(t.validMask&&t.validMask.length!==n))throw Error('aligned 256x256 tile arrays required');
  if(typeof t.sourceSha256!=='string'||!/^[a-f0-9]{64}$/i.test(t.sourceSha256))throw Error('original cached source SHA256 required');
  if(t.pixelAreaM2==null)throw Error('explicit pixelAreaM2 required');
  if(!t.predictions||JSON.stringify(Object.keys(t.predictions).sort())!==JSON.stringify(models))throw Error('same candidates required on every tile');
  for(const m of models)for(const s of ['pre','post'])if(!Array.isArray(t.predictions[m]?.[s])||t.predictions[m][s].length!==n)throw Error('aligned pre/post arrays required');
  if(t.validMask&&t.validMask.some(v=>![true,false,0,1].includes(v)))throw Error('validMask must contain booleans or 0/1');
  const common=t.truth.map((v,i)=>(!t.validMask||!!t.validMask[i])&&decode(v,truthMapping,classes)!==null&&models.every(m=>['pre','post'].every(s=>decode(t.predictions[m][s][i],predictionMappings[m],classes)!==null)));
  support.push({id:t.id,sourceSha256:t.sourceSha256,totalPixels:n,commonKnownPixels:common.filter(Boolean).length,
   unknownByCandidate:Object.fromEntries(models.map(m=>[m,Object.fromEntries(['pre','post'].map(s=>[s,t.truth.reduce((sum,v,i)=>sum+((!t.validMask||!!t.validMask[i])&&decode(v,truthMapping,classes)!==null&&decode(t.predictions[m][s][i],predictionMappings[m],classes)===null?1:0),0)]))]))});
  for(const m of models)for(const s of ['pre','post'])reports[m][s].push({id:t.id,...evaluateMasks({truth:t.truth,prediction:t.predictions[m][s],classes,truthMapping,predictionMapping:predictionMappings[m],validMask:common,pixelAreaM2:t.pixelAreaM2})});
 }
 return {schemaVersion:1,status:'local-supplied-label-evaluation-not-independent-validation',supportPolicy:'intersection across truth, validity, all candidates and both stages; inspect abstentions',support,
 candidates:Object.fromEntries(models.map(m=>[m,Object.fromEntries(['pre','post'].map(s=>[s,{pooled:poolEvaluations(reports[m][s]),tiles:reports[m][s]}]))]))};
}
