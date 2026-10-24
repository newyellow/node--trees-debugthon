import {safeHTTPS} from '../03/model.js';

export const CACHED_ADVICE_VERSION = '4577aeaa30f65e6052df3bc5d9aef737f3d8f7cc9f5eeb82df5982800c70efab';
export const ADVICE_MODES = Object.freeze(['planting', 'home']);
const abortError = () => new DOMException('已停止讀取', 'AbortError');
const check = (signal, isCurrent) => { if (signal?.aborted || !isCurrent()) throw abortError(); };
export function validateSelection(villageId, mode) {
  if (typeof villageId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(villageId) || !ADVICE_MODES.includes(mode)) throw Error('需要有效所選里與建議模式');
}
export function cachedAdviceURL({base='/', villageId, mode, origin=globalThis.location?.origin}={}) {
  validateSelection(villageId, mode);
  const root = new URL(base, origin);
  if (root.origin !== new URL(origin).origin || root.search || root.hash || !root.pathname.endsWith('/')) throw Error('建議資料必須使用同源網站根路徑');
  const url = new URL('data/precomputed-advice/' + encodeURIComponent(villageId) + '.json', root);
  url.searchParams.set('v', CACHED_ADVICE_VERSION);
  return url.href;
}
export function validateCachedAdvice(value, {villageId, mode}={}) {
  validateSelection(villageId, mode);
  if (value?.schemaVersion !== 1 || value.version !== CACHED_ADVICE_VERSION || value.villageId !== villageId || !Object.hasOwn(value.modes || {}, mode)) throw Error('預生成建議版本或里別不符');
  const data = value.modes[mode];
  if (!data || typeof data.answer !== 'string' || !data.answer.trim() || data.answer.length > 12000 || !Array.isArray(data.plants) || data.plants.length > 4 || !Array.isArray(data.sources) || data.sources.length > 20) throw Error('預生成建議格式不符');
  if (data.plants.some(p => typeof p?.name !== 'string' || !p.name.trim() || p.name.length > 100 || (p.scientificName !== undefined && (typeof p.scientificName !== 'string' || p.scientificName.length > 150)))) throw Error('植物資料格式不符');
  if (data.sources.some(s => typeof s?.title !== 'string' || !s.title.trim() || s.title.length > 300 || (s.url != null && (typeof s.url !== 'string' || s.url.length > 1200 || !safeHTTPS(s.url))))) throw Error('來源資料格式不符');
  if (data.tour !== undefined && (mode !== 'planting' || data.tour?.kind !== 'four-region-vision')) throw Error('導覽資料模式不符');
  return {answer:data.answer, plants:data.plants.map(p => ({name:p.name, ...(p.scientificName === undefined ? {} : {scientificName:p.scientificName})})), sources:data.sources.map(s => ({title:s.title, url:safeHTTPS(s.url)})), tour:mode === 'planting' && data.tour?.kind === 'four-region-vision'};
}
export async function loadCachedAdvice({fetcher=(...args)=>fetch(...args), signal, isCurrent=()=>true, ...selection}={}) {
  check(signal, isCurrent);
  const response = await fetcher(cachedAdviceURL(selection), {method:'GET', credentials:'same-origin', redirect:'error', headers:{Accept:'application/json'}, signal});
  check(signal, isCurrent);
  if (!response.ok) throw Error('預生成建議暫時無法讀取');
  const data = await response.json();
  check(signal, isCurrent);
  return validateCachedAdvice(data, selection);
}
/** Local Unicode-codepoint playback only; never opens a network stream. */
export async function playCachedAnswer(answer, {signal, isCurrent=()=>true, reducedMotion=false, onText=()=>{}, interval=18, schedule=setTimeout, unschedule=clearTimeout}={}) {
  check(signal, isCurrent);
  const chars = Array.from(answer);
  if (reducedMotion || !chars.length) { onText(answer); check(signal, isCurrent); return; }
  let text = '';
  for (const char of chars) {
    check(signal, isCurrent);
    text += char; onText(text);
    if (text === answer) break;
    await new Promise((resolve, reject) => {
      const abort = () => { unschedule(timer); signal?.removeEventListener('abort', abort); reject(abortError()); };
      const timer = schedule(() => { signal?.removeEventListener('abort', abort); resolve(); }, interval);
      signal?.addEventListener('abort', abort, {once:true});
      if (signal?.aborted) abort();
    });
  }
  check(signal, isCurrent);
}
