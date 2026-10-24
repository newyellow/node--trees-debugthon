// Compact, local-only scoring policy. Labels are source categories, NOT taxa.
export const SOCIAL_METRICS_VERSION = 'social-demo-v1';
export const SOCIAL_SEED = 'taipei-456-social-demo-2026-10-24-v1';
export const TREE_SNAPSHOT = '2026-10-23T06:37:44.947Z';
export const GAME_SHA256 = '0e8f810191d2288c576849a72c8e7c518dee9e14914ae1c04bff8e4ce1c42227';
export const BLUEPRINT_SHA256 = '32daf4e34908c9d61f303bb9839a8555985a563275b9b8781596c42d685a8aab';
export const BLUEPRINT_NAMES = Object.freeze(['臺灣山櫻花','杜鵑','紅楠','臺灣水青岡','臺灣二葉松','相思樹','樟樹','楠木','山黃麻','臺灣欒樹','青剛櫟','山胡椒','月橘','厚葉石斑木','苦楝','水柳','蘆葦','臺灣野薑花','水社柳']);
export const DEMO_WINDOW = Object.freeze({start:'2026-10-18',end:'2026-10-24',days:7});
export function seededHash(id, key, seed=SOCIAL_SEED) {
  const text=seed+'|'+key+'|'+id; let h=2166136261;
  for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);
  return h>>>0;
}
export function demoMetrics(id,total) {
  if(typeof id!=='string'||!id||!Number.isSafeInteger(total)||total<0)throw new Error('Invalid demo input');
  const score=seededHash(id,'birdInsect')%101;
  const reportedCount=Math.floor(seededHash(id,'activity')/4294967296*(total+1));
  return {birdInsect:{simulated:true,score},activity:{simulated:true,windowDays:7,dueCount:total,reportedCount,rate:total?reportedCount/total*100:0}};
}
const fail=message=>{throw new Error('Social metrics validation: '+message);};
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Pure adapter: validates whole artifact before cloning. Actual game byte SHA is
// verified by the existing loader; this adds pinned identity/snapshot checks.
export function applySocialMetrics(game,metrics) {
  if(!game||!metrics||metrics.schemaVersion!==1||metrics.version!==SOCIAL_METRICS_VERSION||metrics.seed!==SOCIAL_SEED)fail('version/seed');
  if(game.treeSnapshot!==TREE_SNAPSHOT||metrics.treeSnapshot!==TREE_SNAPSHOT||metrics.inputHashes?.['village-game.json']!==GAME_SHA256)fail('snapshot/game SHA');
  for(const file of ['manifest.json','regions.json','street-trees.geojson','park-trees.geojson']) {
    const h=metrics.inputHashes?.[file]; if(!/^[a-f0-9]{64}$/.test(h??'')||!/[1-9a-f]/.test(h)||h!==game.inputHashes?.[file])fail('input SHA '+file);
  }
  if(!eq(metrics.blueprint?.names,BLUEPRINT_NAMES)||metrics.blueprint?.sha256!==BLUEPRINT_SHA256||metrics.blueprint?.status!=='blueprint-native-proxy'||metrics.blueprint?.unlistedPolicy!=='assumed-non-native-for-demo-not-botanical-fact')fail('blueprint');
  if(!eq(metrics.demoWindow,DEMO_WINDOW)||!Number.isFinite(Date.parse(metrics.preparedAt)))fail('demo window/preparation date');
  if(!Array.isArray(game.villages)||game.villages.length!==456||!Array.isArray(metrics.villages)||metrics.villages.length!==456)fail('456 villages');
  const source=new Map(game.villages.map(v=>[v.id,v])),rows=new Map();if(source.size!==456)fail('duplicate game IDs');
  let sum=0,matched=0,unknown=0,dead=0,unlisted=0;
  for(const row of metrics.villages) {
    const v=source.get(row.id),n=row.native;
    if(!v||rows.has(row.id)||!n||!integer(v.trees)||n.total!==v.trees)fail('ID/denominator');
    for(const key of ['total','matched','unlisted','unknown','dead'])if(!integer(n[key]))fail('native counts');
    if(n.total!==n.matched+n.unlisted+n.unknown+n.dead||n.unknown!==v.missingNames||n.dead!==v.deadStatus||n.coverage!==(n.total?(n.total-n.unknown-n.dead)/n.total:0))fail('native coverage');
    const demo=demoMetrics(row.id,n.total);
    if(!eq(row.birdInsect,demo.birdInsect)||!eq(row.activity,demo.activity))fail('seeded demo');
    const scores={nativeShare:n.total?n.matched/n.total*100:0,birdInsect:demo.birdInsect.score,activity:demo.activity.rate};
    if(!eq(row.scores,scores))fail('scores');
    for(const score of Object.values(scores))if(!Number.isFinite(score)||score<0||score>100)fail('score range');
    rows.set(row.id,row);sum+=n.total;matched+=n.matched;unknown+=n.unknown;dead+=n.dead;unlisted+=n.unlisted;
  }
  if(!eq(metrics.totals,{total:sum,matched,unlisted,unknown,dead})||sum!==162321||Object.values(game.treeAudit??{}).reduce((s,a)=>s+a.assigned,0)!==sum)fail('global conservation');
  const {villages,...metadata}=structuredClone(metrics);
  return {...game,socialMetrics:metadata,villages:game.villages.map(v=>({...v,socialMetrics:structuredClone(rows.get(v.id)),scores:{...v.scores,...rows.get(v.id).scores}}))};
}
