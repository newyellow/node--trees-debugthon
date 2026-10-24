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

// All six scores participate; demo/proxy status is explicit, not field evidence.
export const CAPABILITIES = Object.freeze([
  {key:'treeDensity',shortLabel:'樹木密度',label:'管理樹木密度',emoji:'🌳',color:'#238443',simulated:false},
  {key:'protectedDensity',shortLabel:'保護樹木',label:'受保護樹木',emoji:'🛡️',color:'#e58b19',simulated:false},
  {key:'richness',shortLabel:'名稱多樣',label:'來源名稱豐富度',emoji:'🌿',color:'#8654b9',simulated:false},
  {key:'nativeShare',shortLabel:'原生代理',label:'原生比例（藍圖 PROXY）',emoji:'🌱',color:'#478b79',proxy:true,simulated:false,method:'blueprint-native-proxy-v1'},
  {key:'birdInsect',shortLabel:'鳥蟲模擬',label:'鳥類／昆蟲（DEMO）',emoji:'🦋',color:'#c96998',simulated:true,method:'seeded-demo-v1'},
  {key:'activity',shortLabel:'回報模擬',label:'七日回報活躍（DEMO）',emoji:'📣',color:'#278bad',simulated:true,method:'seeded-seven-day-demo-v1'}
].map(Object.freeze));
export const RADAR_CAPABILITIES = CAPABILITIES;
export const TIE_COLOR = '#b45b83', NEUTRAL_COLOR = '#a6adb0';
export function dominantCapability(scores = {}) {
  const valid = CAPABILITIES.filter(c => Number.isFinite(scores?.[c.key]) && scores[c.key] >= 0 && scores[c.key] <= 100);
  const score = valid.length ? Math.max(...valid.map(c => scores[c.key])) : null;
  if (score === null || score === 0) return { kind: 'neutral', keys: [], score, color: NEUTRAL_COLOR, text: score === 0 ? '有效能力分數皆為0（非現地缺乏）' : '尚無有效能力分數（N/A）' };
  const leaders = valid.filter(c => scores[c.key] === score);
  return { kind: leaders.length > 1 ? 'tie' : 'single', keys: leaders.map(c => c.key), score, color: leaders.length > 1 ? TIE_COLOR : leaders[0].color, text: (leaders.length > 1 ? '多項並列最高：' : '最高能力：') + leaders.map(c => c.label).join('、') + ' · ' + score + ' / 100' };
}
