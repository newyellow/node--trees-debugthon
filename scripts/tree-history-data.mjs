import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const LF=String.fromCharCode(10), CRLF=String.fromCharCode(13,10), BOM=String.fromCharCode(65279);
const scopes = new Set(['specific-tree','site-history','planting-policy','general-context']);
const statuses = new Set(['source-supported','lead']);
export function validateCatalogue(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.entries)) throw new Error('Unsupported catalogue schema');
  for (const key of ['updatedAt','description','coverageNote']) if (typeof data[key] !== 'string' || !data[key].trim()) throw new Error('Missing catalogue '+key);
  const ids = new Set();
  for (const row of data.entries) {
    for (const key of ['id','location','period','title','summary','limitations']) if (typeof row[key] !== 'string' || !row[key].trim()) throw new Error('Missing entry '+key);
    if (ids.has(row.id)) throw new Error('Duplicate id '+row.id); ids.add(row.id);
    if (!Array.isArray(row.species) || !row.species.length || row.species.some(v=>typeof v !== 'string' || !v.trim())) throw new Error('Missing species '+row.id);
    if (!scopes.has(row.evidenceScope) || !statuses.has(row.verificationStatus)) throw new Error('Invalid evidence scope/status '+row.id);
    if (!Array.isArray(row.sources) || (row.verificationStatus==='source-supported' && !row.sources.length)) throw new Error('Missing supporting source '+row.id);
    for (const source of row.sources) {
      for (const key of ['title','publisher','url','accessedAt','locator','excerpt']) if (typeof source[key] !== 'string' || !source[key].trim()) throw new Error('Missing source '+key+' '+row.id);
      if (!['https:','http:'].includes(new URL(source.url).protocol)) throw new Error('Unsafe source URL '+row.id);
      if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(source.accessedAt)) throw new Error('Invalid access date '+row.id);
      if (source.publishedAt !== null && typeof source.publishedAt !== 'string') throw new Error('Invalid publication date '+row.id);
    }
  }
  return data;
}
const statusName = value => value==='source-supported'?'來源支持摘要':'待查線索';
const scopeName = value => ({'specific-tree':'特定樹木','site-history':'特定地點背景','planting-policy':'植栽政策／計畫','general-context':'一般文化脈絡'})[value];
export function csvCell(value) {
  let s=String(value ?? '');
  if (/^[=+@-]/.test(s.trimStart())) s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
export function toCsv(data) {
  validateCatalogue(data);
  const rows=[['ID','樹種（來源名稱）','地點','時期','標題','故事摘要','證據範圍','查證狀態','限制','來源標題','來源單位','來源網址','刊出日期','查閱日期','定位資訊','短摘錄']];
  for (const e of data.entries) rows.push([e.id,e.species.join('／'),e.location,e.period,e.title,e.summary,scopeName(e.evidenceScope),statusName(e.verificationStatus),e.limitations,...['title','publisher','url','publishedAt','accessedAt','locator','excerpt'].map(key=>e.sources.map(s=>s[key] ?? '未標示').join(LF))]);
  return BOM+rows.map(row=>row.map(csvCell).join(',')).join(CRLF)+CRLF;
}
const md = value => String(value).replaceAll('|',String.fromCharCode(92)+'|').replaceAll(LF,'<br>');
export function toMarkdown(data) {
  validateCatalogue(data);
  const lines=['# 臺北樹木歷史文化故事資料表','',data.description,'',data.coverageNote,'','更新日期：'+data.updatedAt,'','「來源支持摘要」只表示所列來源正文支持此筆摘要，不表示已完成獨立交叉查證、可推及同樹種所有地區，或已對應現有樹木 GIS 個體。口述、推測與來源未載的種植身世必須保留限制。','', '本表由 public/data/tree-cultural-stories.json 產生；請編輯 JSON 後執行 node scripts/tree-history-data.mjs。CSV：public/data/tree-cultural-stories.csv。','', '| ID | 樹種 | 地點／時期 | 故事摘要 | 證據範圍／狀態 | 來源與定位 | 限制 |','|---|---|---|---|---|---|---|'];
  for (const e of data.entries) lines.push('| '+[e.id,e.species.join('／'),e.location+'；'+e.period,e.title+'：'+e.summary,scopeName(e.evidenceScope)+'／'+statusName(e.verificationStatus),e.sources.map(s=>s.publisher+'：['+s.title+']('+s.url+')；'+s.locator+'；刊出 '+(s.publishedAt||'未標示')+'／查閱 '+s.accessedAt+'；短摘錄「'+s.excerpt+'」').join(LF),e.limitations].map(md).join(' | ')+' |');
  return lines.join(LF)+LF;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root=new URL('../',import.meta.url);
  const data=validateCatalogue(JSON.parse(await readFile(new URL('public/data/tree-cultural-stories.json',root),'utf8')));
  for (const [path,content] of [['public/data/tree-cultural-stories.csv',toCsv(data)],['docs/tree-cultural-stories.md',toMarkdown(data)]]) {
    if (process.argv.includes('--check')) {
      if (await readFile(new URL(path,root),'utf8') !== content) throw new Error('Stale generated artifact '+path);
    } else await writeFile(new URL(path,root),content);
  }
  console.log('Validated '+data.entries.length+' research entries; '+(process.argv.includes('--check')?'exports match':'exports generated'));
}
