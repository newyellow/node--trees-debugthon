import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {csvCell} from './tree-history-data.mjs';
export const sha256 = text => createHash('sha256').update(text).digest('hex');
const usable = new Set(['usable-results','no-results','results','results-accessible','success']);
const statuses=['searched','blocked-search-access','needs-name-review'];
const must=(ok,message)=>{if(!ok)throw Error(message);};
export function buildCoverage(inventoryText,ledgerText,summaryText) {
 const inventory=JSON.parse(inventoryText),ledger=JSON.parse(ledgerText),summary=JSON.parse(summaryText);
 must(inventory.schemaVersion===1 && ledger.schemaVersion===1,'Unsupported schema');
 must(inventory.totalLabels===471 && inventory.entries.length===471 && ledger.entries.length===471,'Expected exactly 471 labels');
 must(ledger.inventorySha256===sha256(inventoryText),'Inventory hash mismatch');
 must(isDeepStrictEqual(inventory.inputs,ledger.inputPins),'Source pins mismatch');
 must(inventory.inputs.length===2 && inventory.inputs.every(p=>/^[a-f0-9]{64}$/.test(p.sha256)&&Number.isInteger(p.records)),'Invalid source pins');
 must(isDeepStrictEqual(summary,ledger.summary),'Summary file mismatch');
 const source=new Map(inventory.entries.map(e=>[e.id,e]));
 must(source.size===471,'Duplicate inventory ID');
 const seen=new Set();
 const entries=ledger.entries.map(e=>{
  const original=source.get(e.id);
  must(original && original.label===e.label && !seen.has(e.id),'Exact ID/label mismatch: '+e.id);seen.add(e.id);
  must(typeof e.label==='string' && Number.isInteger(original.count)&&original.count>=0,'Invalid label/count');
  must(statuses.includes(e.searchStatus)&&Array.isArray(e.queries)&&Array.isArray(e.bodyReviews),'Invalid search status/evidence');
  const hasUsable=e.queries.some(q=>usable.has(q.outcome));
  must((e.searchStatus==='searched')===hasUsable,'Search status disagrees with usable queries: '+e.id);
  must(e.nameStatus===original.nameStatus && (e.searchStatus==='needs-name-review')===(e.nameStatus==='needs-name-review'),'Name status mismatch: '+e.id);
  const queries=e.queries.map(q=>{
   must(typeof q.query==='string'&&q.query.trim()&&typeof q.requestURL==='string'&&typeof q.accessedAt==='string'&&typeof q.outcome==='string','Invalid actual query');
   return {query:q.query,requestURL:q.requestURL,accessedAt:q.accessedAt,outcome:q.outcome};
  });
  return {id:e.id,label:e.label,recordCount:original.count,searchStatus:e.searchStatus,queryCount:queries.length,queries};
 });
 const computed={totalLabels:entries.length,meaningfulLabels:entries.filter(e=>e.searchStatus!=='needs-name-review').length,statusCounts:Object.fromEntries(statuses.map(s=>[s,entries.filter(e=>e.searchStatus===s).length])),labelsWithActualRequest:entries.filter(e=>e.queryCount).length,labelsBlockedWithoutIndividualRequest:entries.filter(e=>e.searchStatus==='blocked-search-access'&&!e.queryCount).length,labelsWithOnlyBlockedRequests:entries.filter(e=>e.searchStatus==='blocked-search-access'&&e.queryCount).length,labelsWithAtLeastTwoDistinctQueries:entries.filter(e=>new Set(e.queries.map(q=>q.query)).size>=2).length,actualDistinctPerLabelQueryStrings:entries.reduce((n,e)=>n+new Set(e.queries.map(q=>q.query)).size,0),actualQueryRequests:entries.reduce((n,e)=>n+e.queryCount,0)};
 for(const [key,value] of Object.entries(computed))must(isDeepStrictEqual(summary[key],value),'Summary mismatch: '+key);
 must(summary.bodyReviews===ledger.entries.reduce((n,e)=>n+e.bodyReviews.length,0),'Body review summary mismatch');
 must(isDeepStrictEqual(summary.nameReview,entries.filter(e=>e.searchStatus==='needs-name-review').map(({id,label})=>({id,label}))),'Name review summary mismatch');
 must(inventory.totalRecords===entries.reduce((n,e)=>n+e.recordCount,0),'Record total mismatch');
 return {schemaVersion:1,updatedAt:ledger.createdAt,description:'來源標籤的首輪搜尋涵蓋進度；不是分類學物種清單，也不是故事有無判定。',limitations:summary.limitations,sourcePins:[{path:'docs/research/species-inventory.json',sha256:sha256(inventoryText)},{path:'docs/research/species-round1/research-ledger.json',sha256:sha256(ledgerText)},{path:'docs/research/species-round1/summary.json',sha256:sha256(summaryText)},...inventory.inputs],summary:computed,entries};
}
export function coverageCsv(data) {
 const LF=String.fromCharCode(10),CRLF=String.fromCharCode(13,10);
 const rows=[['ID','原始標籤','樹木紀錄數','搜尋狀態','實際請求數','搜尋字串','實際請求網址','查詢時間','請求結果']];
 for(const e of data.entries)rows.push([e.id,e.label,e.recordCount,e.searchStatus,e.queryCount,...['query','requestURL','accessedAt','outcome'].map(k=>e.queries.map(q=>q[k]).join(LF))]);
 return String.fromCharCode(65279)+rows.map(row=>row.map(csvCell).join(',')).join(CRLF)+CRLF;
}
export function coverageMarkdown(data) {
 return ['# 原始標籤搜尋涵蓋進度','','由 node scripts/tree-history-coverage.mjs 產生；--check 檢查同步。','','471 是來源標籤數，不是分類學物種數；468 個有意義標籤、3 個名稱待核。170 個取得可用搜尋結果；298 個搜尋受阻（75 個僅受阻請求、223 個未逐名請求）。245 個有實際請求，共 320 次。未搜尋／受阻不表示沒有故事；搜尋結果也不等於已查證故事。','','JSON：public/data/tree-history-search-coverage.json；CSV：public/data/tree-history-search-coverage.csv（UTF-8 BOM、公式字元防護）。空白名稱保持空白，畫面顯示「未提供名稱」。保留實際請求字串、網址、時間和結果，不公開原始回應。','','不從候選故事數推算已確認故事；本表刻意省略故事數。正式故事請查閱獨立的 tree-cultural-stories.json。搜尋進度與故事資料各自載入／重試。無需刷新原始樹木資料。','','## 來源釘選 SHA-256','',...data.sourcePins.map(p=>'- '+p.path+'：'+p.sha256),''].join(String.fromCharCode(10));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const root=new URL('../',import.meta.url);
 const texts=await Promise.all(['docs/research/species-inventory.json','docs/research/species-round1/research-ledger.json','docs/research/species-round1/summary.json'].map(p=>readFile(new URL(p,root),'utf8')));
 const data=buildCoverage(...texts);
 for(const [path,content] of [['public/data/tree-history-search-coverage.json',JSON.stringify(data,null,2)+String.fromCharCode(10)],['public/data/tree-history-search-coverage.csv',coverageCsv(data)],['docs/research/species-search-coverage.md',coverageMarkdown(data)]]){
  if(process.argv.includes('--check'))must(await readFile(new URL(path,root),'utf8')===content,'Stale artifact '+path);else await writeFile(new URL(path,root),content);
 }
 console.log('Validated coverage: '+data.entries.length+' labels; '+data.summary.actualQueryRequests+' requests');
}
