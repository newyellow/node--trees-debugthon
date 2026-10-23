/** Snapshot-relative scores, not ecological health. No DOM access at import time. */
const SVG_NS = 'http://www.w3.org/2000/svg';
const isScore = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
// Restrict paints to hex colors; no url(), CSS variables or invisible paints.
const safeColor = v => typeof v === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : '#53666f';
const point = (c, r, a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });

/** Pure geometry. Missing values have point:null, never an invented zero vertex. */
export function computeRadarGeometry(axes, { size = 180 } = {}) {
  if (!Array.isArray(axes) || axes.length < 3) throw new TypeError('Radar requires at least three axes');
  if (!Number.isFinite(size) || size <= 0 || size > 10000) throw new RangeError('Radar size must be > 0 and <= 10000');
  const center = { x: size / 2, y: size / 2 }, radius = size * 0.30;
  const normalized = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / axes.length;
    const value = isScore(axis?.value) ? axis.value : null;
    return {
      key: String(axis?.key ?? index), label: String(axis?.label ?? axis?.key ?? index + 1),
      color: safeColor(axis?.color), value, angle,
      end: point(center, radius, angle), labelPoint: point(center, radius + size * .09, angle),
      point: value === null ? null : point(center, radius * value / 100, angle),
    };
  });
  const complete = normalized.every(a => a.value !== null), segments = [];
  normalized.forEach((axis, index) => {
    const next = normalized[(index + 1) % normalized.length];
    if (axis.point && next.point) segments.push({ from: axis.point, to: next.point });
  });
  return { size, center, radius, axes: normalized, complete,
    rings: [.25, .5, .75, 1].map(f => normalized.map(a => point(center, radius * f, a.angle))),
    polygon: complete ? normalized.map(a => a.point) : null, segments };
}

/** Host imports CSS explicitly. Creates a fresh, independent DOM subtree. */
export function createCapabilityRadar({ axes, size = 180, compact = false, label = '能力概覽' } = {}) {
  computeRadarGeometry(axes, { size }); // Validate display dimensions.
  const g = computeRadarGeometry(axes, { size: 240 });
  const wrapper = document.createElement('figure');
  wrapper.className = 'radar-chart' + (compact ? ' radar-chart--compact' : '');
  wrapper.style.setProperty('--radar-size', size + 'px');
  const svg = document.createElementNS(SVG_NS, 'svg');
  const uid = 'radar-' + globalThis.crypto.randomUUID();
  for (const [k, v] of Object.entries({ viewBox: '0 0 240 240', class: 'radar-svg', role: 'img', 'aria-labelledby': uid + '-title', 'aria-describedby': uid + '-desc' })) svg.setAttribute(k, v);
  const append = (tag, attrs = {}, content) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    if (content !== undefined) el.textContent = content;
    svg.append(el);
    return el;
  };
  const score = a => a.value === null ? 'N/A（無可用分數）' : a.value + ' / 100';
  const summary = g.axes.map(a => a.label + '：' + score(a)).join('；');
  append('title', { id: uid + '-title' }, String(label));
  append('desc', { id: uid + '-desc' }, '快照相對分數，範圍 0–100，非生態健康評估。' + summary + '。空心叉記號代表 N/A，實心點代表有效分數（包含 0）；資料不完整時不繪製填色區域。');
  const points = pp => pp.map(p => p.x + ',' + p.y).join(' ');
  for (const ring of g.rings) append('polygon', { class: 'radar-ring', points: points(ring) });
  for (const a of g.axes) append('line', { class: 'radar-spoke' + (a.value === null ? ' radar-spoke--missing' : ''), x1: g.center.x, y1: g.center.y, x2: a.end.x, y2: a.end.y });
  append('text', { class: 'radar-scale', x: g.center.x + 4, y: g.center.y - g.radius - 5 }, '100');
  append('text', { class: 'radar-scale', x: g.center.x + 5, y: g.center.y + 13 }, '0');
  if (g.polygon) append('polygon', { class: 'radar-area', points: points(g.polygon) });
  else for (const s of g.segments) append('line', { class: 'radar-segment', x1: s.from.x, y1: s.from.y, x2: s.to.x, y2: s.to.y });
  g.axes.forEach((a, index) => {
    const p = a.point ?? a.end;
    if (a.point) append('circle', { class: 'radar-point', cx: p.x, cy: p.y, r: 4.5, fill: a.color });
    else {
      append('circle', { class: 'radar-missing', cx: p.x, cy: p.y, r: 5 });
      append('path', { class: 'radar-missing-cross', d: 'M' + (p.x - 3) + ',' + (p.y - 3) + 'l6,6m-6,0l6,-6' });
    }
    append('text', { class: 'radar-axis-index', x: a.labelPoint.x, y: a.labelPoint.y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, (index + 1) + (a.value === null ? ' N/A' : ''));
  });
  wrapper.append(svg);
  const caption = document.createElement('figcaption');
  caption.className = 'radar-caption';
  const addText = (tag, cls, value, parent = caption) => {
    const el = document.createElement(tag); el.className = cls; el.textContent = value; parent.append(el); return el;
  };
  addText('span', 'radar-heading', String(label));
  addText('span', 'radar-units', '快照相對分數 0–100 · 非生態健康評估');
  const list = document.createElement('ol'); list.className = 'radar-values';
  for (const [index, a] of g.axes.entries()) {
    const item = document.createElement('li'); item.className = 'radar-value' + (a.value === null ? ' radar-value--missing' : '');
    addText('span', 'radar-name', (index + 1) + '. ' + a.label, item); addText('strong', 'radar-score', score(a), item); list.append(item);
  }
  caption.append(list); wrapper.append(caption);
  return wrapper;
}
