import L from 'leaflet';
import RBush from 'rbush';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { matches, unionBounds, gridGroups } from './explorer.js';
import { TREE_LAYERS, buildDensityGrid, densityColor, visibleDensityCells } from './density.js';

const $ = selector => document.querySelector(selector);
const format = value => value.toLocaleString('zh-TW');
const districts = ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'];
districts.forEach(name => $('#district').add(new Option(name, name)));
const state = { definitions: [], active: new Set(['street-trees', 'parks']), data: new Map(), pending: new Map(), errors: new Map(), district: '', query: '', opacity: new Map(), mode: 'points', cellSize: 250, heatOpacity: 0.6 };
const map = L.map('map', { zoomControl: false, preferCanvas: true, minZoom: 10, maxZoom: 19 }).setView([25.048, 121.542], 13);
L.control.zoom({ position: 'topright' }).addTo(map);
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
const base = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(map);
base.on('tileerror', () => { $('#tile-error').hidden = false; });
base.on('tileload', () => { $('#tile-error').hidden = true; });
map.createPane('areas'); map.getPane('areas').style.zIndex = 410;
map.createPane('points'); map.getPane('points').style.zIndex = 430;
map.createPane('density'); map.getPane('density').style.zIndex = 405;
const drawing = L.layerGroup().addTo(map);
let densityCache;
let scheduled;
function scheduleRender() { clearTimeout(scheduled); scheduled = setTimeout(renderMap, 90); }
map.on('moveend zoomend', scheduleRender);

function externalLink(url, text) {
  const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = text; return link;
}
function notify(message) { $('#map-notice').textContent = message; }
function featurePopup(feature, definition) {
  const box = document.createElement('div'); box.className = 'feature-popup';
  const tag = document.createElement('div'); tag.className = 'popup-tag'; tag.style.color = definition.color; tag.textContent = definition.title;
  const title = document.createElement('h3'); title.textContent = feature.properties._name;
  box.append(tag, title);
  const table = document.createElement('dl');
  const labels = { TreeID: '樹木編號', Dist: '行政區', Region: '路段', RegionRemark: '位置補充', TreeType: '樹種', Diameter: '胸徑（原值）', TreeHeight: '樹高（原值）', SurveyDate: '調查日期', UpdDate: '紀錄更新', ParkName: '公園名稱', Town_N: '行政區（原值）', NAME_Road: '路名', SWW_WTH: '淨寬（原值）', SW_WTH_ItemValue: '寬度（原值）', Name: '設施類型', pm_name: '公園名稱', pm_regions: '行政區', pm_location: '位置', pm_LandPublicArea: '面積（原值）' };
  for (const [key, value] of Object.entries(feature.properties)) {
    if (key.startsWith('_')) continue;
    const dt = document.createElement('dt'); dt.textContent = labels[key] ?? key;
    const dd = document.createElement('dd'); dd.textContent = value === null || value === '' ? '未提供' : String(value);
    table.append(dt, dd);
  }
  box.append(table, externalLink(definition.source, '官方資料集 ↗')); return box;
}
function fitBounds(bounds, maxZoom = 17) {
  if (bounds) map.fitBounds([[bounds[1], bounds[0]], [bounds[3], bounds[2]]], { padding: [55, 55], maxZoom });
}
function filteredFeatures(id) { return (state.data.get(id)?.features ?? []).filter(f => matches(f, state.district, state.query)); }
function visibleLayerIds() { return [...state.active].filter(id => state.mode !== 'density' || TREE_LAYERS.has(id)); }
function allMatching() { return visibleLayerIds().flatMap(filteredFeatures); }

function renderDensity(bounds) {
  const ids = visibleLayerIds().filter(id => state.data.has(id));
  const key = JSON.stringify([ids, state.district, state.query, state.cellSize]);
  if (densityCache?.key !== key) {
    densityCache = { key, grid: buildDensityGrid(ids.map(id => ({ id, features: filteredFeatures(id) })), state.cellSize) };
  }
  const cells = visibleDensityCells(densityCache.grid, [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
  for (const cell of cells) {
    const color = densityColor(cell.density);
    L.polygon(cell.ring.map(([lng, lat]) => [lat, lng]), { pane: 'density', color, weight: 0.4, opacity: state.heatOpacity, fillColor: color, fillOpacity: state.heatOpacity, className: 'density-cell' })
      .bindTooltip(`${format(cell.count)} 筆 · ${cell.density.toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 筆／公頃`)
      .bindPopup(() => {
        const box = document.createElement('div'); box.className = 'density-popup';
        const title = document.createElement('h3'); title.textContent = `${state.cellSize} × ${state.cellSize} 公尺網格`;
        const total = document.createElement('p'); total.textContent = `${format(cell.count)} 筆樹木紀錄 · ${cell.density.toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 筆／公頃`;
        box.append(title, total);
        for (const id of visibleLayerIds()) {
          const row = document.createElement('p'); row.textContent = `${state.definitions.find(d => d.id === id).title}：${format(cell.byLayer[id] ?? 0)} 筆`; box.append(row);
        }
        const note = document.createElement('small'); note.textContent = '完整網格統計，套用目前篩選。0 筆代表沒有符合的紀錄，不表示現地無樹；網格範圍不代表已完成調查。'; box.append(note); return box;
      }, { maxWidth: 300 }).addTo(drawing);
  }
  $('#density-legend').dataset.cells = cells.length;
  $('#cell-area').textContent = `${state.cellSize} m × ${state.cellSize} m · 每格 ${state.cellSize ** 2 / 10000} 公頃`;
}

function renderMap() {
  drawing.clearLayers(); map.closePopup();
  let count = 0;
  const bounds = map.getBounds(), zoom = map.getZoom();
  const heat = state.mode === 'density', visibleIds = visibleLayerIds();
  map.getPane('areas').hidden = heat;
  map.getPane('points').hidden = heat;
  map.getPane('density').hidden = !heat;
  if (heat) renderDensity(bounds);
  const areaItems = [], pointItems = [];
  for (const definition of state.definitions) {
    if (!state.active.has(definition.id)) continue;
    if (!visibleIds.includes(definition.id)) { $(`#count-${definition.id}`).textContent = '點位模式顯示'; continue; }
    const dataset = state.data.get(definition.id);
    if (!dataset) continue;
    const features = dataset.index.search({ minX: bounds.getWest(), minY: bounds.getSouth(), maxX: bounds.getEast(), maxY: bounds.getNorth() }).map(item => item.feature).filter(f => matches(f, state.district, state.query));
    count += features.length;
    $(`#count-${definition.id}`).textContent = `${format(features.length)} 筆在視野內`;
    if (heat) continue;
    const opacity = state.opacity.get(definition.id) ?? 0.8;
    const showAreas = definition.kind === 'polygon' && zoom >= (definition.id === 'tree-pits' ? 18 : 15);
    if (showAreas) {
      areaItems.push(() => L.geoJSON({ type: 'FeatureCollection', features }, { pane: 'areas', style: { color: definition.color, weight: 1.5, opacity, fillOpacity: opacity * 0.3 }, onEachFeature: (feature, layer) => layer.bindPopup(() => featurePopup(feature, definition), { maxWidth: 340 }) }).addTo(drawing));
      continue;
    }
    const cellSize = definition.id === 'parks' || zoom >= 17 ? 1 : 56;
    const groups = gridGroups(features, coordinate => map.project(coordinate, zoom), cellSize);
    for (const group of groups) {
      pointItems.push(() => {
        const total = group.features.length;
        if (total === 1) {
          L.circleMarker([group.lat, group.lng], { pane: 'points', radius: definition.id === 'parks' ? 6 : 4, color: '#fff', weight: 1, fillColor: definition.color, fillOpacity: opacity, opacity }).bindPopup(() => featurePopup(group.features[0], definition), { maxWidth: 340 }).addTo(drawing);
        } else {
          const size = Math.min(48, 24 + Math.log10(total) * 7);
          const marker = L.marker([group.lat, group.lng], { pane: 'points', icon: L.divIcon({ className: 'cluster-wrap', html: `<span class="cluster" style="--cluster-color:${definition.color};width:${size}px;height:${size}px;opacity:${opacity}">${format(total)}</span>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }) });
          marker.bindTooltip(`${definition.title} · ${format(total)} 筆（點擊放大）`);
          marker.on('click', () => {
            if (zoom >= 19) {
              const box = document.createElement('div'); box.className = 'overlap-list';
              const title = document.createElement('strong'); title.textContent = `此處重疊 ${format(total)} 筆`; box.append(title);
              for (const feature of group.features) {
                const button = document.createElement('button'); button.textContent = `${feature.properties._name} · ${feature.properties.TreeID ?? feature.properties.ID ?? feature.properties.OBJECTID ?? ''}`;
                button.onclick = () => L.popup({ maxWidth: 340 }).setLatLng([group.lat, group.lng]).setContent(featurePopup(feature, definition)).openOn(map); box.append(button);
              }
              marker.bindPopup(box).openPopup();
            } else fitBounds(unionBounds(group.features), Math.min(19, zoom + 3));
          }); marker.addTo(drawing);
        }
      });
    }
  }
  areaItems.forEach(draw => draw()); pointItems.forEach(draw => draw());
  $('#visible-count').textContent = format(count);
  $('#active-count').textContent = visibleIds.length;
  $('#summary-label').textContent = heat ? '目前視野內・符合篩選的樹木紀錄' : '目前視野內・已勾選圖層';
  $('#layer-count').textContent = `${visibleIds.length} / ${heat ? TREE_LAYERS.size : state.definitions.length}`;
  $('.section-help').textContent = heat ? '勾選要納入密度統計的樹木資料' : '勾選疊加圖層，點擊地圖查看細節';
  $('#map-title').replaceChildren(document.createTextNode(state.district || '臺北市'), Object.assign(document.createElement('span'), { textContent: state.district ? 'Taipei City' : 'Taipei' }));
  $('#zoom-label').textContent = `ZOOM ${zoom}`;
  $('#density-legend').hidden = !heat;
  $('#legend-items').hidden = heat;
  $('#legend-note').textContent = heat ? '紅少 → 黃中 → 綠多。只畫符合資料的外接矩形；0 筆不代表現地無樹，無色區不作判讀。' : '圓圈數字為合併筆數，點擊可放大。放大後顯示獨立點位與面域。';
  $('#legend-items').replaceChildren(...state.definitions.filter(d => state.active.has(d.id)).map(d => {
    const row = document.createElement('div'); row.className = 'legend-row';
    const swatch = document.createElement('i'); swatch.style.backgroundColor = d.color; if (d.kind === 'polygon') swatch.className = 'area-swatch';
    row.append(swatch, document.createTextNode(d.title)); return row;
  }));
  const pending = visibleIds.filter(id => state.pending.has(id)).length;
  const failed = visibleIds.filter(id => state.errors.has(id)).length;
  if (pending) notify(`正在載入 ${pending} 個圖層，首次載入大型資料可能需要數秒…`);
  else if (failed) notify(`${failed} 個圖層載入失敗，可按圖層下方「重試」。`);
  else if (heat && !visibleIds.length) notify('請勾選「行道樹」或「公園樹木」，開始查看密度。');
  else if (!state.active.size) notify('從左側勾選圖層，開始探索臺北。');
  else if (heat && !densityCache?.grid.total) notify('沒有符合的樹木紀錄；請調整行政區或搜尋條件。');
  else if (heat) notify(`密度模式 · ${state.cellSize} 公尺固定網格 · 紅少、黃中、綠多 · 點擊網格查看筆數。`);
  else if (!count) notify('目前視野沒有符合的資料；可調整篩選或按「符合資料」。');
  else notify(zoom < 15 ? '全覽模式 · 數字圓圈合併顯示所有紀錄，點擊可放大。' : zoom < 18 ? '街區模式 · 樹穴放大至層級 18 顯示實際範圍。' : '細節模式 · 點擊點位或面域，查看官方原始屬性。');
}

async function loadLayer(definition) {
  if (state.data.has(definition.id)) return;
  if (state.pending.has(definition.id)) return state.pending.get(definition.id);
  state.errors.delete(definition.id);
  const promise = (async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/${definition.file}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('資料格式不正確');
      const index = new RBush();
      index.load(data.features.map(feature => ({ minX: feature.bbox[0], minY: feature.bbox[1], maxX: feature.bbox[2], maxY: feature.bbox[3], feature })));
      state.data.set(definition.id, { features: data.features, index });
    } catch (error) { state.errors.set(definition.id, error.message); }
    finally { state.pending.delete(definition.id); renderLayers(); scheduleRender(); }
  })();
  state.pending.set(definition.id, promise); renderLayers(); scheduleRender();
  return promise;
}
function renderLayers() {
  $('#layers').replaceChildren(...state.definitions.map(definition => {
    const unavailable = state.mode === 'density' && !TREE_LAYERS.has(definition.id);
    const active = state.active.has(definition.id), loaded = state.data.has(definition.id), pending = state.pending.has(definition.id), error = state.errors.get(definition.id);
    const card = document.createElement('div'); card.className = `layer-card ${active ? 'active' : ''}`; card.style.setProperty('--layer-color', definition.color);
    card.classList.toggle('density-unavailable', unavailable);
    const label = document.createElement('label'); label.className = 'layer-label';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = active; checkbox.setAttribute('aria-label', `顯示${definition.title}`);
    checkbox.disabled = unavailable;
    checkbox.onchange = () => {
      if (checkbox.checked) { state.active.add(definition.id); loadLayer(definition); } else state.active.delete(definition.id);
      renderLayers(); scheduleRender();
    };
    const swatch = document.createElement('span'); swatch.className = `layer-swatch ${definition.kind}`;
    const title = document.createElement('strong'); title.textContent = definition.title;
    const total = document.createElement('span'); total.className = 'layer-total'; total.textContent = format(definition.valid);
    label.append(checkbox, swatch, title, total);
    const meta = document.createElement('div'); meta.className = 'layer-meta';
    const status = document.createElement('span'); status.id = `count-${definition.id}`;
    status.textContent = unavailable ? '點位模式顯示' : error ? `載入失敗：${error}` : pending ? '載入中…' : active && loaded ? '已載入' : definition.kind === 'point' ? '位置點資料' : '面域資料';
    meta.append(status, externalLink(definition.source, '來源 ↗'));
    card.append(label, meta);
    if (active) {
      const description = document.createElement('p'); description.className = 'layer-description'; description.textContent = definition.description; card.append(description);
      if (error) { const retry = document.createElement('button'); retry.className = 'retry-button'; retry.textContent = '重試'; retry.onclick = () => loadLayer(definition); card.append(retry); }
      const rangeLabel = document.createElement('label'); rangeLabel.className = 'opacity-control'; rangeLabel.append(document.createTextNode('透明度'));
      const range = document.createElement('input'); range.type = 'range'; range.min = '0.1'; range.max = '1'; range.step = '0.1'; range.value = state.opacity.get(definition.id) ?? 0.8; range.setAttribute('aria-label', `${definition.title}透明度`);
      range.oninput = () => { state.opacity.set(definition.id, Number(range.value)); scheduleRender(); };
      rangeLabel.append(range); if (state.mode !== 'density') card.append(rangeLabel);
    }
    return card;
  }));
}

function setMode(mode) {
  state.mode = mode;
  $('#point-mode').setAttribute('aria-pressed', mode === 'points');
  $('#density-mode').setAttribute('aria-pressed', mode === 'density');
  $('#density-controls').hidden = mode !== 'density';
  $('.map-legend').classList.toggle('heat-legend', mode === 'density');
  renderLayers(); scheduleRender();
}
$('#point-mode').onclick = () => setMode('points');
$('#density-mode').onclick = () => setMode('density');
$('#grid-size').onchange = event => { state.cellSize = Number(event.target.value); scheduleRender(); };
$('#heat-opacity').oninput = event => { state.heatOpacity = Number(event.target.value); scheduleRender(); };

$('#district').onchange = async event => {
  state.district = event.target.value;
  scheduleRender();
  await Promise.all([...state.pending.values()]);
  const bounds = unionBounds(allMatching()); if (bounds) fitBounds(bounds, 14); else renderMap();
};
let searchTimer;
$('#search').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.query = $('#search').value.trim().toLocaleLowerCase(); scheduleRender(); }, 250); };
$('#search-form').onsubmit = async event => {
  event.preventDefault(); clearTimeout(searchTimer); state.query = $('#search').value.trim().toLocaleLowerCase();
  await Promise.all([...state.pending.values()]);
  const bounds = unionBounds(allMatching()); if (bounds) fitBounds(bounds); renderMap();
};
$('#clear-layers').onclick = () => { state.active.clear(); renderLayers(); renderMap(); };
$('#reset-map').onclick = () => { state.district = ''; state.query = ''; $('#district').value = ''; $('#search').value = ''; clearTimeout(searchTimer); map.setView([25.048, 121.542], 13); renderMap(); };
$('#fit-data').onclick = async () => { await Promise.all([...state.pending.values()]); const bounds = unionBounds(allMatching()); if (bounds) fitBounds(bounds); else notify('沒有符合的資料，請選擇圖層或調整搜尋條件。'); };
$('#about-button').onclick = () => $('#about-dialog').showModal();
$('#close-dialog').onclick = () => $('#about-dialog').close();
$('#about-dialog').onclick = event => { if (event.target === $('#about-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); } };

async function init() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/manifest.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json(); state.definitions = manifest.layers;
    const fetchedAt = new Date(manifest.fetchedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
    $('#snapshot-date').textContent = `快照 ${fetchedAt.split(' ')[0]}`;
    const report = $('#quality-report');
    const date = document.createElement('p'); date.className = 'snapshot-line'; date.textContent = `擷取時間：${fetchedAt}（臺北時間）`; report.append(date);
    for (const d of state.definitions) {
      const row = document.createElement('article'); row.className = 'quality-row';
      const header = document.createElement('h3'); header.append(externalLink(d.source, `${d.title} ↗`));
      const p = document.createElement('p'); p.textContent = `原始 ${format(d.total)} 筆 · 可繪製 ${format(d.valid)} 筆 · 座標異常排除 ${format(d.excluded)} 筆 · 缺行政區 ${format(d.missingDistrict)} 筆`;
      const note = document.createElement('small'); note.textContent = `${d.agency} / ${d.originalCrs}${d.latestRecordUpdate ? ` / 最新一筆紀錄更新 ${d.latestRecordUpdate}` : ' / 未提供逐筆更新時間'}`;
      row.append(header, p, note); report.append(row);
    }
    renderLayers(); await Promise.all(state.definitions.filter(d => state.active.has(d.id)).map(loadLayer)); renderMap();
  } catch (error) {
    $('#layers').textContent = `資料目錄載入失敗：${error.message}。請重新整理，或執行 npm run data:refresh。`;
    notify('資料目錄無法載入，請確認 public/data 下的資料檔案。');
  }
}
init();
