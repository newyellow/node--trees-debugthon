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
  for (const s of e.sources) if (!s || !['title','publisher','accessedAt','locator','excerpt'].every(k=>string(s[k])) || !safeSourceURL(s.url) || !(s.publishedAt === null || string(s.publishedAt))) throw new Error('來源格式不符');
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
