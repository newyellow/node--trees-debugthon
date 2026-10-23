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
