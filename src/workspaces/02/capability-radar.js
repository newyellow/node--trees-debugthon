import {createMetricIcon} from './radar-icons.js';
/** Snapshot-relative scores, not ecological health. No DOM access at import time. */
const SVG_NS = 'http://www.w3.org/2000/svg';
const isScore = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
// Restrict paints to hex colors; no url(), CSS variables or invisible paints.
const safeColor = v => typeof v === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : '#53666f';
const point = (c, r, a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });

/** Pure geometry. Missing values have point:null, displayPoint may explicitly opt into a zero-radius placeholder. */
export function computeRadarGeometry(axes, { size = 180, missingAtZero = false } = {}) {
  if (!Array.isArray(axes) || axes.length < 3) throw new TypeError('Radar requires at least three axes');
  if (!Number.isFinite(size) || size <= 0 || size > 10000) throw new RangeError('Radar size must be > 0 and <= 10000');
  const center = { x: size / 2, y: size / 2 }, radius = size * 0.30;
  const normalized = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / axes.length;
    const value = isScore(axis?.value) ? axis.value : null;
    const measuredPoint = value === null ? null : point(center, radius * value / 100, angle);
    return {
      key: String(axis?.key ?? index), label: String(axis?.label ?? axis?.key ?? index + 1),
      shortLabel: typeof axis?.shortLabel === 'string' ? axis.shortLabel : '',
      emoji: typeof axis?.emoji === 'string' ? axis.emoji : '',
      color: safeColor(axis?.color), value, angle,
      end: point(center, radius, angle), labelPoint: point(center, radius + size * .09, angle),
      point: measuredPoint,
      displayPoint: measuredPoint ?? (missingAtZero === true ? { ...center } : null),
    };
  });
  const complete = normalized.every(a => a.value !== null), segments = [];
  normalized.forEach((axis, index) => {
    const next = normalized[(index + 1) % normalized.length];
    if (axis.point && next.point) segments.push({ from: axis.point, to: next.point });
  });
  return { size, center, radius, axes: normalized, complete, missingAtZero: missingAtZero === true,
    rings: [.25, .5, .75, 1].map(f => normalized.map(a => point(center, radius * f, a.angle))),
    polygon: complete ? normalized.map(a => a.point) : null,
    displayPolygon: complete || missingAtZero === true ? normalized.map(a => a.displayPoint) : null, segments };
}

/** Host imports CSS explicitly. Creates a fresh, independent DOM subtree. */
export function createCapabilityRadar({ axes, size = 180, compact = false, pixelStyle = false, label = '能力概覽', missingAtZero = false } = {}) {
  computeRadarGeometry(axes, { size, missingAtZero }); // Validate display dimensions.
  const g = computeRadarGeometry(axes, { size: 240, missingAtZero });
  const wrapper = document.createElement('figure');
  wrapper.className = 'radar-chart' + (compact ? ' radar-chart--compact' : '') + (pixelStyle ? ' radar-chart--pixel' : '');
  wrapper.style.setProperty('--radar-size', size + 'px');
  const svg = document.createElementNS(SVG_NS, 'svg');
  const uid = 'radar-' + globalThis.crypto.randomUUID();
  for (const [k, v] of Object.entries({ viewBox: '-16 -2 272 244', class: 'radar-svg', role: 'img', 'aria-labelledby': uid + '-title', 'aria-describedby': uid + '-desc' })) svg.setAttribute(k, v);
  const append = (tag, attrs = {}, content) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    if (content !== undefined) el.textContent = content;
    svg.append(el);
    return el;
  };
  const score = a => a.value === null ? 'N/A（無可用分數）' : Math.round(a.value) + ' / 100';
  const summary = g.axes.map(a => a.label + '：' + score(a)).join('；');
  append('title', { id: uid + '-title' }, String(label));
  const policy = g.missingAtZero
    ? 'N/A 僅為顯示置於零半徑中心，仍是缺值而非實際 0 分；不完整的展示輪廓使用虛線，不能視為完整評分。'
    : '缺值在軸端標記；資料不完整時不繪製填色區域，亦不跨越缺值連線。';
  append('desc', { id: uid + '-desc' }, '快照相對分數，單位為 0–100 分，非生態健康評估。' + summary + '。空心叉記號代表 N/A，實心點代表有效分數（包含 0）。' + policy);
  const points = pp => pp.map(p => p.x + ',' + p.y).join(' ');
  const rings=pixelStyle ? [.2,.4,.6,.8,1].map(f=>g.axes.map(a=>({x:g.center.x+(a.end.x-g.center.x)*f,y:g.center.y+(a.end.y-g.center.y)*f}))) : g.rings;
  for (const ring of rings) append('polygon', { class: 'radar-ring', points: points(ring) });
  for (const a of g.axes) append('line', { class: 'radar-spoke' + (a.value === null ? ' radar-spoke--missing' : ''), x1: g.center.x, y1: g.center.y, x2: a.end.x, y2: a.end.y });
  append('text', { class: 'radar-scale', x: g.center.x + 4, y: g.center.y - g.radius - 5 }, '100');
  append('text', { class: 'radar-scale', x: g.center.x + 5, y: g.center.y + 13 }, '0');
  if (g.displayPolygon) append('polygon', { class: 'radar-area' + (g.complete ? '' : ' radar-area--missing'), points: points(g.displayPolygon) });
  else for (const s of g.segments) append('line', { class: 'radar-segment', x1: s.from.x, y1: s.from.y, x2: s.to.x, y2: s.to.y });
  g.axes.forEach(a => {
    const p = a.displayPoint ?? a.end;
    if (a.point) { if(pixelStyle)append('rect',{class:'radar-point',x:p.x-4,y:p.y-4,width:8,height:8});else append('circle', { class: 'radar-point', cx: p.x, cy: p.y, r: 4.5, fill: a.color }); }
  });
  // Draw crosses last so a real zero cannot obscure the missing marker.
  g.axes.forEach(a => {
    if (a.value === null) {
      const p = a.displayPoint ?? a.end;
      append('circle', { class: 'radar-missing' + (g.missingAtZero ? ' radar-missing--center' : ''), cx: p.x, cy: p.y, r: g.missingAtZero ? 7 : 5 });
      append('path', { class: 'radar-missing-cross', d: 'M' + (p.x - 3) + ',' + (p.y - 3) + 'l6,6m-6,0l6,-6' });
    }
  });
  g.axes.forEach((a, index) => {
    if(pixelStyle){
      const group=append('g',{class:'radar-axis-index radar-axis-pixel','data-metric-key':a.key});
      group.append(createMetricIcon(a.key,{x:a.labelPoint.x-43,y:a.labelPoint.y-12}));
      const text=document.createElementNS(SVG_NS,'text');for(const[k,v]of Object.entries({class:'radar-axis-label',x:a.labelPoint.x-15,y:a.labelPoint.y,'text-anchor':'start','dominant-baseline':'central'}))text.setAttribute(k,String(v));text.setAttribute('style','font-size:'+([...a.shortLabel||a.label].length>4?'10':'14')+'px');text.textContent=(a.shortLabel||a.label)+(a.value===null?' N/A':'');group.append(text);return;
    }
    if (!a.shortLabel) { append('text', { class: 'radar-axis-index' + (a.emoji ? ' radar-axis-emoji' : ''), x: a.labelPoint.x, y: a.labelPoint.y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, (a.emoji || index + 1) + (a.value === null ? ' N/A' : '')); return; }
    const axis = append('text', { class: 'radar-axis-index' + (a.emoji ? ' radar-axis-emoji' : ''), x: a.labelPoint.x, y: a.labelPoint.y, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    const icon = document.createElementNS(SVG_NS, 'tspan'); icon.textContent = a.emoji || index + 1; axis.append(icon);
    if (a.shortLabel) { const name = document.createElementNS(SVG_NS, 'tspan'); name.setAttribute('class', 'radar-axis-label'); name.setAttribute('dx', '4'); name.textContent = a.shortLabel; axis.append(name); }
    if (a.value === null) { const missing = document.createElementNS(SVG_NS, 'tspan'); missing.textContent = ' N/A'; axis.append(missing); }
  });
  wrapper.append(svg);
  const caption = document.createElement('figcaption');
  caption.className = 'radar-caption';
  const addText = (tag, cls, value, parent = caption) => {
    const el = document.createElement(tag); el.className = cls; el.textContent = value; parent.append(el); return el;
  };
  addText('span', 'radar-heading', String(label));
  addText('span', 'radar-units', '快照相對分數 0–100 · 非生態健康評估');
  if (g.missingAtZero && !g.complete) addText('span', 'radar-policy', 'N/A 暫置 0；不代表實際零分。');
  const list = document.createElement('ol'); list.className = 'radar-values';
  for (const [index, a] of g.axes.entries()) {
    const item = document.createElement('li'); item.className = 'radar-value' + (a.value === null ? ' radar-value--missing' : '');
    addText('span', 'radar-name', (a.emoji ? a.emoji + ' ' : (index + 1) + '. ') + a.label, item); addText('strong', 'radar-score', score(a), item); list.append(item);
  }
  caption.append(list); wrapper.append(caption);
  return wrapper;
}
