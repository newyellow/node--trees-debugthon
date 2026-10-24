// Source labels are categories, not reconciled botanical taxonomy. No implicit network/DOM work.
const normalize = value => typeof value === 'string' ? value.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\s+/gu, ' ').trim() : '';
const unknown = new Set(['', '-', '--', '無', '不明', '未知', '未提供', '未辨識', '其他', 'unknown', 'null', 'n/a', 'na', '未提供／未辨識', '未提供/未辨識', '未載明樹種', '枯木', '烏?']);
const MAX_BYTES = 2 * 1024 * 1024;
function validate(catalogue) {
  if (!catalogue || !Array.isArray(catalogue.entries) || catalogue.entries.length > 2000) throw new Error('故事資料格式不符（entries）');
  for (const e of catalogue.entries) if (!e || !Array.isArray(e.species) || !e.species.every(s => typeof s === 'string') || !['location', 'title', 'summary', 'evidenceScope', 'verificationStatus'].every(k => typeof e[k] === 'string') || !Array.isArray(e.sources)) throw new Error('故事資料格式不符（entry）');
  return catalogue;
}
function districtPosition(location, district) {
  if (!/^[\p{Script=Han}]{1,6}區$/u.test(district)) return -1;
  // Require address/list boundary or an explicit city prefix, not 新北投區 matching 北投區.
  for (let i = location.indexOf(district); i >= 0; i = location.indexOf(district, i + 1)) {
    if (i === 0 || /[\s、，,（(;；／/]$/u.test(location.slice(0, i)) || /(?:臺北市|台北市)$/u.test(location.slice(0, i))) return i;
  }
  return -1;
}
function explicitVillage(location, village, district, position) {
  if (position < 0 || !/^[\p{Script=Han}]{1,6}里$/u.test(village)) return false;
  let segment = location.slice(position + district.length).split(/[；;。]/u)[0];
  const nextDistrict = segment.search(/[\p{Script=Han}]{1,3}區/u);
  if (nextDistrict >= 0) segment = segment.slice(0, nextDistrict);
  for (let i = segment.indexOf(village); i >= 0; i = segment.indexOf(village, i + 1)) {
    const before = segment.slice(0, i), after = segment.slice(i + village.length);
    if ((i === 0 || /[\s、，,（(／/與及暨里]$/u.test(before)) && (!after || /^[\s、，,）)／/與及暨觀內境之的]/u.test(after))) return true;
  }
  return false;
}
/** Original entry references, catalogue order, one group per exact normalized category match.
 * general/regional are NOT local stories; no GIS-individual attribution is implied.
 */
export function queryStories(catalogue, { species = '', village = '', district = '' } = {}) {
  validate(catalogue);
  species = normalize(species); village = normalize(village); district = normalize(district);
  const result = { local: [], regional: [], general: [], leads: [] };
  if (!unknown.has(species.toLowerCase())) for (const entry of catalogue.entries) {
    if (!entry.species.some(s => normalize(s) === species)) continue;
    const location = normalize(entry.location), position = districtPosition(location, district);
    const group = entry.verificationStatus !== 'source-supported' ? 'leads' : explicitVillage(location, village, district, position) ? 'local' : position >= 0 ? 'regional' : 'general';
    result[group].push(entry);
  }
  result.metadata = {
    species, village, district, catalogueCount: catalogue.entries.length,
    matchedCount: Object.values(result).reduce((n, entries) => n + entries.length, 0),
    labels: { local: '來源明載本區本里（不等於現存個體身世）', regional: '本行政區背景（非本里故事）', general: '同來源樹種名稱的其他地點／文化背景（非本里故事）', leads: '待查研究線索（未證實，非本里事實）' },
    coverageNote: typeof catalogue.coverageNote === 'string' ? catalogue.coverageNote : '',
  };
  return result;
}
/** load() is lazy, deduplicated and cached. Rejection clears in-flight state: call load()
 * again for explicit retry. UI owns generation/stale-result protection. base = Vite BASE_URL.
 */
export function createStoryQueryLoader({ base = '/', fetcher = globalThis.fetch } = {}) {
  if (typeof fetcher !== 'function') throw new TypeError('故事資料載入需要 fetcher');
  if (typeof base !== 'string') throw new TypeError('故事資料 base 必須是字串');
  const url = base.replace(/\/?$/, '/') + 'data/tree-cultural-stories.json';
  let cached, pending;
  const load = () => {
    if (cached) return Promise.resolve(cached);
    if (pending) return pending;
    pending = (async () => {
      const controller = new AbortController();
      let timer;
      try {
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('故事資料載入逾時；請重試')); }, 15000); });
        const request = (async () => {
          const response = await fetcher(url, { signal: controller.signal });
          if (!response?.ok) throw new Error('故事資料載入失敗（HTTP ' + (response?.status ?? 'unknown') + '）；請重試');
          if (Number(response.headers?.get('content-length')) > MAX_BYTES) throw new Error('故事資料超過大小上限');
          let text;
          if (response.body?.getReader) {
            const reader = response.body.getReader(), decoder = new TextDecoder();
            let bytes = 0; text = '';
            try { for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('故事資料超過大小上限'); } text += decoder.decode(value, { stream: true }); } text += decoder.decode(); }
            finally { reader.releaseLock(); }
          } else {
            text = await response.text();
            if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('故事資料超過大小上限');
          }
          try { return validate(JSON.parse(text)); }
          catch (error) { throw new Error('故事資料解析失敗；請重試', { cause: error }); }
        })();
        cached = await Promise.race([request, timeout]);
        return cached;
      } finally { clearTimeout(timer); pending = undefined; }
    })();
    return pending;
  };
  return { load };
}
