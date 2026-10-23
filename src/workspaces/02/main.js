import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { CAPABILITIES, dominantCapability, TIE_COLOR, NEUTRAL_COLOR } from './domain.js';
const $ = id => document.getElementById(id), base = import.meta.env.BASE_URL;
let data, regions, map, group, selected, visible = [], layers = new Map();
function el(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; }
const fmt = (v, digits = 0) => Number.isFinite(v) ? v.toLocaleString('zh-TW', { maximumFractionDigits: digits }) : 'N/A';
function card(title, score, raw, note) {
  const n = el('article', undefined, 'card'); n.append(el('h3', title));
  const number = el('p', score === null ? 'N/A' : score + ' / 100', 'score'); n.append(number);
  if (score !== null) { const meter = el('meter'); meter.min = 0; meter.max = 100; meter.value = score; meter.setAttribute('aria-label', title + '相對分數'); n.append(meter); }
  n.append(el('p', raw, 'raw'), el('p', note, 'caveat')); return n;
}
function select(id, fit = true) {
  const v = data.villages.find(r => r.id === id); if (!v) return; selected = id;
  layers.forEach((l, key) => l.setStyle({ color: key === id ? '#172f35' : '#50616a', weight: key === id ? 4 : 1, fillOpacity: key === id ? .70 : .48 }));
  map.stop(); map.invalidateSize({pan:false,animate:false});
  layers.get(id)?.bringToFront(); if (fit && layers.has(id)) map.fitBounds(layers.get(id).getBounds(), { animate: false, paddingTopLeft: [24,110], paddingBottomRight: innerWidth > 760 ? [440,70] : innerHeight <= 500 ? [365,40] : [24, Math.round(innerHeight*.52)], maxZoom: 16 });
  openPanel('passport', document.activeElement);
  const strongest = dominantCapability(v.scores); $('strongest').textContent = strongest.text; $('strongest').style.borderColor = strongest.color;
  $('passport-toggle').hidden = false;
  $('passport').querySelector('.panel-scroll').scrollTop = 0;
  $('village-title').textContent = v.district + '・' + v.name;
  $('village-meta').textContent = '里全面積 ' + fmt(v.areaKm2, 3) + ' km²｜固定參考母體：全臺北456里｜快照 ' + data.treeSnapshot.slice(0,10);
  $('cards').replaceChildren(
    card('01 管理樹木密度 · 代理指標', v.scores.treeDensity, fmt(v.treeDensity,1) + ' 筆/km²｜' + fmt(v.trees) + ' 筆 ÷ ' + fmt(v.areaKm2,3) + ' km²', '不是綠覆率、樹冠面積或全里樹木普查。'),
    card('02 官方受保護樹木紀錄', v.scores.protectedDensity, fmt(v.protectedDensity,1) + ' 筆/km²｜名冊 ' + fmt(v.protected) + ' 筆 ÷ ' + fmt(v.areaKm2,3) + ' km²', '文化局名冊空間歸屬；非候選大樹。資料期間較舊，法律現況須查證。'),
    card('03 管理樹木名稱豐富度', v.scores.richness, fmt(v.richness) + ' 類｜有名稱 ' + fmt(v.knownNames) + '/' + fmt(v.trees) + ' 筆', 'Shannon ' + fmt(v.shannon,3) + '；最大類別占比 ' + (v.dominance === null ? 'N/A' : fmt(v.dominance*100,1) + '%') + '。未知 ' + v.missingNames + '、枯木 ' + v.deadStatus + ' 筆。非全植物物種數；受取樣量影響。'),
    card('04 原生比例', null, '待分類對照', '尚無審核過的名稱→分類群對照；未知不是外來種，不計假零。'),
    card('05 鳥類／昆蟲圖鑑', null, '待可靠觀測資料', '未納入精度、授權與努力量可比較的觀測；沒有紀錄不等於沒有生物。'),
    card('06 散步便利 · 清潔箱代理', v.scores.binDensity, fmt(v.binDensity,1) + ' 處/km²｜' + v.bins + ' 處 ÷ ' + fmt(v.areaKm2,3) + ' km²', '僅行人清潔箱快照密度；不是整體便利性、清潔程度或步行可達性。未納入廁所、飲水與跨里設施。')
  );
  [...$('cards').children].forEach((n,i) => { const c = CAPABILITIES[[0,1,2,-1,-1,3][i]]; n.style.setProperty('--capability', c?.color || NEUTRAL_COLOR); if(c) n.dataset.capability = c.key; });
  document.querySelectorAll('#villages button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
}
function filter() {
  const district = $('district').value, query = $('search').value.trim();
  visible = data.villages.filter(v => (!district || v.district === district) && (v.district + v.name).includes(query));
  const ids = new Set(visible.map(v => v.id));
  layers.forEach((l,id) => { if (ids.has(id)) { if (!group.hasLayer(l)) group.addLayer(l); } else group.removeLayer(l); });
  $('result-count').textContent = visible.length + ' 里符合條件';
  $('villages').replaceChildren(...visible.map(v => { const li = el('li'), b = el('button', v.district + '・' + v.name); b.type = 'button'; b.dataset.id = v.id; b.setAttribute('aria-pressed', String(v.id === selected)); b.onclick = () => select(v.id); li.append(b); return li; }));
  if (visible.length && district) map.fitBounds(group.getBounds(), { animate: false, padding: [15,15] });
}
function provenance() {
  const p = $('provenance'); p.replaceChildren();
  p.append(el('p', '管理樹快照：' + data.treeSnapshot + '；里界擷取：' + data.boundaryFetchedAt + '；彙整：' + data.preparedAt));
  p.append(el('p', '管理樹162,369筆＝里內162,321＋未歸屬48。以實際座標重新驗證全部歸屬與來源SHA-256；有來源名稱不等於已校對物種。'));
  function link(text, url) { const a = el('a', text); a.href = url; a.target = '_blank'; a.rel = 'noopener'; p.append(a, el('br')); }
  link(data.treeSource.agency + '・管理樹來源', data.treeSource.url); link('臺北市官方里界來源', data.boundarySource);
  for (const s of data.sources) { const a = s.audit; p.append(el('p', s.agency + '｜' + s.title + '｜下載 ' + (s.fetchedAt || '快取（擷取時間未留存）') + '｜原始 ' + a.raw + '、無效座標 ' + a.invalidCoordinates + '、重複 ' + a.duplicates + '、有效唯一 ' + a.uniqueValid + '、里內 ' + a.assigned + '、未歸屬 ' + a.unmatched + '。' + (s.key === 'protected' ? '檔案更新2026-03-23，metadata資料涵蓋至2023-04-11；胸徑單位公尺，未用於分數。' : '來源更新日期未確認；未宣稱即時。以地址＋座標去除完全重複。'))); link('來源：' + s.title, s.source); link(s.license, s.licenseUrl); }
  link('管理樹／里界：政府資料開放授權條款', data.treeSource.licenseUrl);
}
async function load() {
  $('retry').hidden = true; $('status').textContent = '正在整理地圖與里環境護照…';
  try {
    const fetchJSON = async name => { const r = await fetch(base + 'data/' + name, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error('HTTP ' + r.status); const bytes = await r.arrayBuffer(); return { bytes, json: JSON.parse(new TextDecoder().decode(bytes)) }; };
    const [d,r] = await Promise.all([fetchJSON('village-game.json'), fetchJSON('regions.json')]); data = d.json; regions = r.json;
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', r.bytes))].map(n => n.toString(16).padStart(2,'0')).join('');
    if (data.schemaVersion !== 1 || data.villages.length !== 456 || regions.features.length !== 456 || regions.treeSnapshot !== data.treeSnapshot || digest !== data.inputHashes['regions.json']) throw new Error('快照或里界版本不一致');
    const ids = new Set(regions.features.map(f => f.properties.id)); if (new Set(data.villages.map(v => v.id)).size !== 456 || data.villages.some(v => !ids.has(v.id))) throw new Error('里代碼不一致');
    if (!map) {
      map = L.map('map', { scrollWheelZoom: true, zoomControl: false, zoomAnimation: false }).setView([25.06,121.55],11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).on('tileerror', () => { $('tile-status').textContent = '底圖暫時無法載入；里界與清單仍可操作。請稍後重新整理以重試底圖。'; }).addTo(map);
      L.control.zoom({ position: 'bottomleft' }).addTo(map);
      group = L.featureGroup().addTo(map);
    }
    group.clearLayers(); layers = new Map();
    const villagesById = new Map(data.villages.map(v => [v.id,v]));
    regions.features.forEach(f => {
      const v = villagesById.get(f.properties.id), strength = dominantCapability(v.scores);
      const l = L.geoJSON(f, { style: { color: '#50616a', weight: 1, fillColor: strength.color, fillOpacity: .48 } });
      l.bindTooltip(() => el('span', v.district + v.name + '｜' + strength.text));
      l.on('click', () => select(v.id, false));
      l.eachLayer(path => {
        path.on('add', () => { const node = path.getElement(); node.dataset.village = v.id; node.setAttribute('tabindex','0'); node.setAttribute('role','button'); node.setAttribute('aria-label',v.district + v.name + '｜' + strength.text);
          node.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); select(v.id,false); } });
        });
      });
      layers.set(v.id,l); group.addLayer(l);
    });
    $('district').replaceChildren(el('option', '全臺北市')); $('district').firstChild.value = '';
    [...new Set(data.villages.map(v => v.district))].sort().forEach(d => { const o = el('option',d); o.value = d; $('district').append(o); });
    ['district','search','reset'].forEach(id => $(id).disabled = false);
    $('district').onchange = filter; $('search').oninput = filter;
    $('reset').onclick = () => { $('district').value = ''; $('search').value = ''; filter(); map.fitBounds(group.getBounds(), { animate: false, padding: [12,12] }); };
    filter(); map.fitBounds(group.getBounds(), { animate: false, padding: [12,12] });
    provenance();
    $('status').textContent = '護照已就緒・456里界與真實快照｜分數是資料相對位置，不是地方好壞。';
  } catch (error) { $('status').textContent = '資料載入失敗：' + error.message + '。請檢查連線後重試。'; $('retry').hidden = false; }
}
const panelIds = ['finder','passport','legend','method'], returnFocus = new Map();
function closePanel(id, focus = true) {
  $(id).hidden = true; $(id+'-toggle')?.setAttribute('aria-expanded','false');
  if(focus) { const target = returnFocus.get(id); if(target?.isConnected && !target.closest('[hidden]')) target.focus({preventScroll:true}); else $(id+'-toggle')?.focus({preventScroll:true}); }
}
function openPanel(id, trigger) {
  panelIds.forEach(other => { if(other !== id) closePanel(other,false); });
  returnFocus.set(id,trigger); $(id).hidden = false; $(id+'-toggle')?.setAttribute('aria-expanded','true');
  $(id).querySelector('button')?.focus({preventScroll:true});
}
panelIds.forEach(id => {
  const toggle = $(id+'-toggle'); toggle.onclick = () => $(id).hidden ? openPanel(id,toggle) : closePanel(id);
  $(id).querySelector('[data-close]').onclick = () => closePanel(id);
});
for(const node of document.querySelectorAll('.surface')) { L.DomEvent.disableClickPropagation(node); L.DomEvent.disableScrollPropagation(node); }
document.addEventListener('keydown', e => { if(e.key === 'Escape') { const id = panelIds.find(id => !$(id).hidden); if(id) { e.preventDefault(); closePanel(id); } } });
for(const item of [...CAPABILITIES, {label:'多項正值能力並列最高',color:TIE_COLOR}, {label:'有效分數皆0／無有效分數',color:NEUTRAL_COLOR}]) {
  const li = el('li',item.label); const swatch = el('span',undefined,'swatch'); swatch.style.background = item.color; li.prepend(swatch); $('legend-items').append(li);
}
$('retry').onclick = load; load();
