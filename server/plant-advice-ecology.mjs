import {createHash} from 'node:crypto';
export const ECOLOGY_SHA256='91bf27d063c3e3dd2cc2b07d438ec96702d985b5a3f73ff769838e051ce06fd9';
export const ECOLOGY_FILE='mountain-ecology-knowledge.json';
export const ECOLOGY_CITATION={title:'五指山南緣、南港山系與市民大道七八段植物調查｜使用者提供DOCX，2020年6月／2021年2月；作者未確認、非現況普查',url:'https://trees.piyellowclaw.xyz/data/mountain-ecology-knowledge.json?v='+ECOLOGY_SHA256};
const fail=()=>{throw new Error('Ecological source validation failed');};
export function parseEcology(bytes) {
 if(createHash('sha256').update(bytes).digest('hex')!==ECOLOGY_SHA256)fail();
 const d=JSON.parse(bytes);
 if(d.schemaVersion!==1||d.id!=='taipei-mountain-ecology-20261024'||d.source.sha256!=='ede609af5f36f10ce5bb31c350a7fdd5abaafa5a7cf91f517e11c81c798266b7'||d.source.author!==null||d.groups.length!==40||d.records.length!==365||d.summary.distinctSourceLabels!==204||d.summary.fullTaxonInventoryAvailable!==false)fail();
 const groups=new Map(d.groups.map(g=>[g.id,g]));
 if(groups.size!==40||new Set(d.records.map(r=>r.id)).size!==365)fail();
 for(const r of d.records) {const g=groups.get(r.groupId);if(!g||!g.names.includes(r.nameAsPrinted)||g.locator!==r.locator||g.area!==r.area)fail();}
 return d;
}
export function projectEcology(d,district,blueprint) {
 const region=blueprint.regions.find(r=>r.districts.includes(district));
 const link=d.regionLinks.find(r=>r.regionId===region?.id);
 const covered=!!link&&link.relation!=='not-covered';
 const base={sourceTitle:d.source.title,sourceId:d.source.id,author:null,sourceStatus:d.source.status,surveyPeriods:d.source.surveyPeriods,planRegionId:region?.id||null,relation:link?.relation||'not-covered',selectedVillageSurveyed:false,caveat:link?.caveat||'此規劃分區沒有本文件直接調查資料。'};
 if(!covered)return {...base,observations:[],candidateReferences:[],note:'不可把其他山系或市民大道的調查當成本里現況或適種依據。'};
 const blocked=new Set(d.recommendationPolicy.excludedFromAutomaticCandidates);
 const area=region.id==='nangang'?'南港山系':'五指山系南緣';
 const kinds=new Set(['dominant-replacement','pioneer','ridge-remnant','closed-canopy','shrub-layer','ground-layer']);
 const observations=d.groups.filter(g=>g.area===area&&kinds.has(g.kind)).map(g=>({habitat:g.kind,area:g.area,names:g.names.filter(n=>!blocked.has(n)),locator:g.locator,period:g.period,evidenceType:g.evidenceType}));
 // Design proposals apply to the named corridor only; never relabel them as observations in a selected village.
 const proposals=d.groups.filter(g=>g.evidenceType==='source-design-proposal');
 const candidates=new Map();
 for(const g of proposals)for(const name of g.names)if(!blocked.has(name)) {
  if(!candidates.has(name))candidates.set(name,{name,roles:[],locators:[],sourceNotes:[],area:g.area,evidenceType:'source-design-proposal',siteSuitabilityVerified:false});
  const c=candidates.get(name);c.roles.push(g.kind);c.locators.push(g.locator);c.sourceNotes.push(g.designNote);
 }
 const candidateReferences=[...candidates.values()].slice(0,20);
 const contextClaims=['transect','microhabitats','adaptation-not-native-only','shade-caution','maintenance','diversity-and-disease'].map(id=>{const c=d.claims.find(c=>c.id===id);return {summary:c.summary,locator:c.locator};});
 return {...base,observations,candidateReferences,contextClaims,restrictions:[...d.recommendationPolicy.restrictions,'山系調查和走廊設計可擴充候選參考，不代表所選里已調查；非室內或陽台植物清單。','只引用有來源定位的生境／設計理由；資料未給的成樹大小、安全性、學名、動物成效、全年物候不得補猜。'],dataIssues:d.issues.filter(x=>['first-total','status-subtotals','percentages','taxon-labels','origin-conflict','missing-inventory'].includes(x.id)).map(x=>({id:x.id,detail:x.detail}))};
}
