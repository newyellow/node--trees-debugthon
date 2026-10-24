export function relativeScore(value, cohort) {
  if (!Number.isFinite(value) || value < 0) return null;
  if (value === 0) return 0;
  const values = cohort.filter(v => Number.isFinite(v) && v >= 0);
  if (!values.length) return null;
  if (values.length === 1) return 100;
  const less = values.filter(v => v < value).length, equal = values.filter(v => v === value).length;
  return Math.round(100 * (less + (equal - 1) / 2) / (values.length - 1));
}
export function parseCSV(bytes, encoding = 'utf-8') {
  const text = (typeof bytes === 'string' ? bytes : new TextDecoder(encoding, { fatal: true }).decode(bytes)).replace(/^﻿/, '');
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  row.push(field); if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift();
  if (!headers || new Set(headers).size !== headers.length) throw new Error('Invalid CSV headers');
  return rows.map(values => { if (values.length !== headers.length) throw new Error('CSV column mismatch'); return Object.fromEntries(headers.map((h, i) => [h, values[i]])); });
}
export function validCoordinate(lng, lat) {
  return String(lng).trim() !== '' && String(lat).trim() !== '' && Number.isFinite(Number(lng)) && Number.isFinite(Number(lat)) && +lng >= 121.3 && +lng <= 121.8 && +lat >= 24.8 && +lat <= 25.3;
}

// Only validated, currently scored capabilities may contribute; never coerce N/A to zero.
export const CAPABILITIES = Object.freeze([
  { key: 'treeDensity', label: '管理樹木密度', emoji: '🌳', color: '#238443' },
  { key: 'protectedDensity', label: '受保護樹木', emoji: '🛡️', color: '#e58b19' },
  { key: 'richness', label: '來源名稱豐富度', emoji: '🌿', color: '#8654b9' }
].map(Object.freeze));
// Display-only axes do not join dominant capability or ranking calculations.
export const RADAR_CAPABILITIES = Object.freeze([
  ...CAPABILITIES.slice(0,3),
  Object.freeze({key:'nativeShare',label:'原生比例',emoji:'🌱',color:'#667867',unavailable:true}),
  Object.freeze({key:'birdInsect',label:'鳥類／昆蟲',emoji:'🦋',color:'#667867',unavailable:true})
]);
export const TIE_COLOR = '#b45b83', NEUTRAL_COLOR = '#a6adb0';
export function dominantCapability(scores = {}) {
  const valid = CAPABILITIES.filter(c => Number.isFinite(scores?.[c.key]) && scores[c.key] >= 0 && scores[c.key] <= 100);
  const score = valid.length ? Math.max(...valid.map(c => scores[c.key])) : null;
  if (score === null || score === 0) return { kind: 'neutral', keys: [], score, color: NEUTRAL_COLOR, text: score === 0 ? '有效能力分數皆為0（非現地缺乏）' : '尚無有效能力分數（N/A）' };
  const leaders = valid.filter(c => scores[c.key] === score);
  return { kind: leaders.length > 1 ? 'tie' : 'single', keys: leaders.map(c => c.key), score, color: leaders.length > 1 ? TIE_COLOR : leaders[0].color, text: (leaders.length > 1 ? '多項並列最高：' : '最高能力：') + leaders.map(c => c.label).join('、') + ' · ' + score + ' / 100' };
}
