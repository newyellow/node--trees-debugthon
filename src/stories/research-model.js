export const SCOPES = Object.freeze({'specific-tree':'特定樹木','site-history':'場域歷史','planting-policy':'植栽政策','general-context':'一般文化背景'});
export const STATUSES = Object.freeze({'source-supported':'有來源支持',lead:'待查線索'});
const string = value => typeof value === 'string' && value.trim().length > 0;
export function safeSourceURL(value) {
 try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function validateResearchData(data) {
 if (!data || data.schemaVersion !== 1 || !string(data.updatedAt) || !string(data.description) || !string(data.coverageNote) || !Array.isArray(data.entries)) throw new Error('研究資料格式不符');
 const ids = new Set();
 for (const e of data.entries) {
  if (!e || !['id','location','period','title','summary','limitations'].every(k=>string(e[k])) || ids.has(e.id) || !Array.isArray(e.species) || !e.species.length || !e.species.every(string) || !Object.hasOwn(SCOPES,e.evidenceScope) || !Object.hasOwn(STATUSES,e.verificationStatus) || !Array.isArray(e.sources) || !e.sources.length) throw new Error('研究條目格式不符');
  ids.add(e.id);
  for (const s of e.sources) if (!s || !['title','publisher','accessedAt','locator','excerpt'].every(k=>string(s[k])) || !(s.kind==='provided-document' ? s.url===null && string(s.documentId) && string(s.documentPath) && /^docs\/research\/[a-zA-Z0-9_/-]+\.pdf$/.test(s.documentPath) && !s.documentPath.split('/').includes('..') && Number.isInteger(s.page) && s.page>0 && Number.isInteger(s.pdfPage) && s.pdfPage>0 : safeSourceURL(s.url)) || !(s.publishedAt === null || string(s.publishedAt))) throw new Error('來源格式不符');
 }
 return data;
}
const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().trim();
export function filterEntries(entries,{species='',location='',query='',status='all'}={}) {
 const words = normalize(query).split(/\s+/).filter(Boolean);
 return entries.filter(e=> {
  if (status !== 'all' && e.verificationStatus !== status) return false;
  if (!normalize(e.species.join(' ')).includes(normalize(species))) return false;
  if (!normalize(e.location).includes(normalize(location))) return false;
  const full = normalize([e.title,e.summary,...e.species,e.location,e.period,e.limitations,SCOPES[e.evidenceScope],...e.sources.flatMap(s=>[s.title,s.publisher,s.locator,s.excerpt])].join(' '));
  return words.every(word=>full.includes(word));
 });
}

export const SEARCH_STATUSES = Object.freeze({searched:'已取得可用搜尋結果','blocked-search-access':'搜尋受阻','needs-name-review':'名稱待核'});
export function coverageStatus(entry) {
 if(entry.searchStatus==='blocked-search-access')return entry.queryCount ? '僅有受阻請求' : '未逐名請求（管道受阻）';
 return SEARCH_STATUSES[entry.searchStatus];
}
export function filterCoverage(entries,query='') {
 const words=normalize(query).split(/\s+/).filter(Boolean);
 return entries.filter(e=>words.every(w=>normalize([e.id,e.label||'未提供名稱',coverageStatus(e),...e.queries.map(q=>q.query)].join(' ')).includes(w)));
}
export function validateCoverageData(data) {
 if(data?.schemaVersion!==1 || !Array.isArray(data.entries) || data.entries.length!==471 || !data.summary || !Array.isArray(data.sourcePins))throw Error('搜尋進度格式不符');
 const ids=new Set();
 for(const e of data.entries){
  if(!e || typeof e.label!=='string' || !string(e.id) || ids.has(e.id) || !Number.isInteger(e.recordCount) || e.recordCount<0 || !Object.hasOwn(SEARCH_STATUSES,e.searchStatus) || !Array.isArray(e.queries) || e.queryCount!==e.queries.length || !e.queries.every(q=>string(q.query)&&typeof q.requestURL==='string'&&string(q.outcome)))throw Error('搜尋標籤格式不符');
  ids.add(e.id);
 }
 if(data.summary.totalLabels!==471 || data.summary.actualQueryRequests!==data.entries.reduce((n,e)=>n+e.queryCount,0))throw Error('搜尋統計格式不符');
 return data;
}
