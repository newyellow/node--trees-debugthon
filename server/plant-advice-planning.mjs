import {createHash} from 'node:crypto';
export const PLANNING_FILE='street-tree-planning-knowledge.json';
export const PLANNING_SHA256='209be6b5459f1b22d981b4a1de7ebcb23aee61784a0eaae6461994848f64e807';
export const PLANNING_CITATION={title:'Justin提供行道樹規劃PPT｜29樹高用名、12區數量前五排名、2018轉引名錄；原作者及調查日期未確認'};
export function parsePlanning(bytes){
 if(createHash('sha256').update(bytes).digest('hex')!==PLANNING_SHA256)throw Error('Planning source hash mismatch');
 const d=JSON.parse(bytes);if(d.schemaVersion!==1||d.heightRecommendations.length!==29||d.districtRanks.length!==60||d.cited2018.source_names.length!==20||new Set(d.districtRanks.map(r=>r.district)).size!==12)throw Error('Planning source coverage mismatch');return d;
}
export function projectPlanning(d,district){
 const blocked=new Set(d.policy.excludedRecommendations);
 return {sourceId:d.id,sourceSha256:d.source.sha256,originalAuthor:null,districtInventoryDate:null,selectedVillageSurveyed:false,
 districtRanks:d.districtRanks.filter(r=>r.district===district).map(({rank,source_name,slide,slide_id})=>({rank,nameAsPrinted:source_name,slide,slideId:slide_id,evidenceType:'source-district-ranking-not-village-inventory'})),
 heightReferences:d.heightRecommendations.filter(r=>!blocked.has(r.source_name)).map(({source_name,height_group,source_height_wording,slide,slide_id})=>({nameAsPrinted:source_name,group:height_group,heightAsPrinted:source_height_wording,slide,slideId:slide_id,siteSuitabilityVerified:false})),
 cited2018:{citation:d.cited2018.citation_verbatim,names:d.cited2018.source_names.filter(n=>!blocked.has(n)),originalVerified:false},
 limitations:d.limitations,restrictions:['不得把行政區排名當成本里組成；所選里現況只依village管理樹資料。','排除名單僅控制新植推薦；既有樹木照顧與原始資料保留。','不可把樹高分類當室內、陽台適種依據；不猜學名。']};
}
