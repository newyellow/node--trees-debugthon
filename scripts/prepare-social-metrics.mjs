import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {speciesName,UNKNOWN_SPECIES} from '../src/species.js';
import {SOCIAL_METRICS_VERSION,SOCIAL_SEED,TREE_SNAPSHOT,GAME_SHA256,BLUEPRINT_SHA256,BLUEPRINT_NAMES,DEMO_WINDOW,demoMetrics,applySocialMetrics} from '../src/workspaces/02/social-metrics.js';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root));
const sha=b=>createHash('sha256').update(b).digest('hex');
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const gameBytes=await read('public/data/village-game.json');assert(sha(gameBytes)===GAME_SHA256,'Village game SHA mismatch');
const game=JSON.parse(gameBytes),inputHashes={'village-game.json':sha(gameBytes)},inputs={};
for(const file of ['manifest.json','regions.json','street-trees.geojson','park-trees.geojson']) {
  const bytes=await read('public/data/'+file),hash=sha(bytes);
  assert(/^[a-f0-9]{64}$/.test(game.inputHashes[file]??'')&&hash===game.inputHashes[file],'Missing/mismatched SHA '+file);
  inputHashes[file]=hash;inputs[file]=JSON.parse(bytes);
}
const recordBytes=await readFile('/Users/piyellow/.openclaw/workspace-trees-debugthon/artifacts/knowledge-intake/2026-10-24-hong-taipei-vegetation-plan/record.json');
assert(sha(recordBytes)===BLUEPRINT_SHA256,'Blueprint record SHA mismatch');
const record=JSON.parse(recordBytes),names=[...new Set(record.regions.flatMap(r=>r.plantNamesAsPrinted).map(speciesName))];
assert(record.regions.length===4&&JSON.stringify(names)===JSON.stringify(BLUEPRINT_NAMES),'Exact 19 blueprint labels mismatch');
const regions=inputs['regions.json'];assert(regions.treeSnapshot===TREE_SNAPSHOT&&inputs['manifest.json'].fetchedAt===TREE_SNAPSHOT,'Snapshot mismatch');
assert(regions.features.length===456&&game.villages.length===456,'Village count');
const rows=new Map(game.villages.map(v=>[v.id,{id:v.id,native:{total:0,matched:0,unlisted:0,unknown:0,dead:0,coverage:0}}]));
assert(rows.size===456,'Duplicate village IDs');const nameSet=new Set(names);const audit={};
for(const id of ['street-trees','park-trees']) {
  const features=inputs[id+'.geojson'].features,membership=regions.membership[id],ids=new Set();let unmatched=0;
  assert(membership.length===features.length,'Membership length');
  for(let i=0;i<features.length;i++) {
    const f=features[i],identity=String(f.properties.TreeID??'');assert(identity&&!ids.has(identity),'Tree identity');ids.add(identity);
    const index=membership[i];assert(Number.isInteger(index)&&index>=-1&&index<456,'Membership index');
    if(index<0){unmatched++;continue;}
    const row=rows.get(regions.features[index].properties.id);assert(row,'Membership village ID');
    const n=row.native,name=speciesName(f.properties.TreeType);n.total++;
    if(name===UNKNOWN_SPECIES)n.unknown++;else if(name==='枯木')n.dead++;else if(nameSet.has(name))n.matched++;else n.unlisted++;
  }
  audit[id]={total:features.length,assigned:features.length-unmatched,unmatched};
  for(const key of ['total','assigned','unmatched'])assert(audit[id][key]===game.treeAudit[id][key],'Global tree conservation '+id+' '+key);
}
for(const v of game.villages) {
  const row=rows.get(v.id),n=row.native;assert(n.total===v.trees,'Village count '+v.id);
  n.coverage=n.total?(n.total-n.unknown-n.dead)/n.total:0;Object.assign(row,demoMetrics(v.id,n.total));
  row.scores={nativeShare:n.total?n.matched/n.total*100:0,birdInsect:row.birdInsect.score,activity:row.activity.rate};
}
const totals={total:0,matched:0,unlisted:0,unknown:0,dead:0};for(const r of rows.values())for(const k of Object.keys(totals))totals[k]+=r.native[k];
const output={schemaVersion:1,version:SOCIAL_METRICS_VERSION,seed:SOCIAL_SEED,preparedAt:new Date().toISOString(),treeSnapshot:TREE_SNAPSHOT,inputHashes,
  blueprint:{names,sha256:BLUEPRINT_SHA256,status:'blueprint-native-proxy',unlistedPolicy:'assumed-non-native-for-demo-not-botanical-fact',title:record.title,attribution:record.sourceAttribution,receivedDate:record.receivedDate,provenanceUrl:record.messageUrl,publicProvenancePolicy:'Compact 19 labels, user-supplied attribution and record SHA only; no original image or full transcription; not a botanical inventory or reproduction license.'},
  nativePolicy:{version:'blueprint-native-proxy-v1',denominator:'all-managed-tree-records',normalization:'shared-speciesName-exact-label-no-aliases',zeroTrees:0},
  demoWindow:{...DEMO_WINDOW},simulation:{birdInsect:true,activity:true,method:'fnv1a-utf16-per-metric-village-v1',notice:'鳥類／昆蟲及七日回報均為 seeded DEMO 指派資料，並非真實觀測、回報或上傳。'},audit,totals,villages:[...rows.values()]};
applySocialMetrics(game,output);
const file=new URL('public/data/social-metrics.json',root);await writeFile(new URL(file+'.tmp'),JSON.stringify(output));await rename(new URL(file+'.tmp'),file);
console.log(JSON.stringify({villages:rows.size,totals,audit,preparedAt:output.preparedAt,sha256:sha(await readFile(file))},null,2));
