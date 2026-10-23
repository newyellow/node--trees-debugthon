import L from 'leaflet';
import { aggregateSpecies, speciesName, speciesColor, UNKNOWN_SPECIES } from './species.js';
const $ = s => document.querySelector(s);
const num = n => n.toLocaleString('zh-TW', { maximumFractionDigits: 3 });
const pct = n => n === null ? '無法計算' : num(n * 100) + '%';
const tooltip = text => { const span = document.createElement('span'); span.textContent = text; return span; };
const line = (box, text, tag = 'p') => { const el = document.createElement(tag); el.textContent = text; box.append(el); return el; };
export function createSpecies({ state, map, scene, loadLayer, scheduleRender, fitBounds }) {
  let regions, pending, error, cache, catalogueKey, catalog = [], selectionVersion = 0;
  state.speciesDatasets = new Set(['street-trees', 'park-trees']); state.speciesSelected = new Set(); state.speciesLevel = 'distribution';
  const ids = () => [...state.speciesDatasets];
  const sourceName = id => state.definitions.find(d => d.id === id)?.title ?? id;
  async function ensure() {
    if (state.mode !== 'species') return;
    for (const id of ids()) { const d = state.definitions.find(d => d.id === id); if (d && !state.data.has(id) && !state.pending.has(id)) loadLayer(d); }
    if (!regions && !pending) {
      error = ''; pending = (async () => {
        try { const r = await fetch(import.meta.env.BASE_URL + 'data/regions.json'); if (!r.ok) throw new Error('HTTP ' + r.status); const data = await r.json(); if (data.treeSnapshot !== state.snapshot) throw new Error('區里歸屬與快照版本不符'); regions = data; }
        catch (e) { error = e.message; } finally { pending = null; scheduleRender(); }
      })();
    }
  }
  $('#species-level').onchange = e => { state.speciesLevel = e.target.value; scheduleRender(); };
  $('#species-search').oninput = renderCatalogue;
  $('#species-clear').onclick = () => { state.speciesSelected.clear(); selectionVersion++; renderCatalogue(); scheduleRender(); };
  $('#species-retry').onclick = () => { error = ''; ensure(); scheduleRender(); };
  for (const id of ['street-trees', 'park-trees']) $('#species-' + id).onchange = e => { e.target.checked ? state.speciesDatasets.add(id) : state.speciesDatasets.delete(id); ensure(); scheduleRender(); };
  function renderCatalogue() {
    const q = $('#species-search').value.trim().toLowerCase();
    const visible = catalog.filter(r => r.name.toLowerCase().includes(q));
    $('#species-options').replaceChildren(...visible.map(r => {
      const label = document.createElement('label'), input = document.createElement('input'), swatch = document.createElement('i');
      input.type = 'checkbox'; input.checked = state.speciesSelected.has(r.name); input.value = r.name;
      input.onchange = () => { input.checked ? state.speciesSelected.add(r.name) : state.speciesSelected.delete(r.name); selectionVersion++; $('#species-selection-note').textContent = visible.length + ' 個來源名稱類別；已選 ' + state.speciesSelected.size + '；未選＝全部。搜尋只縮小選單，不改統計。'; scheduleRender(); };
      swatch.style.backgroundColor = speciesColor(r.name); label.append(input, swatch, document.createTextNode(r.name + ' · ' + num(r.count))); return label;
    }));
    $('#species-selection-note').textContent = visible.length + ' 個來源名稱類別；已選 ' + state.speciesSelected.size + '；未選＝全部。搜尋只縮小選單，不改統計。';
  }
  function detail(row, omitted) {
    const box = document.createElement('div'); box.className = 'species-popup';
    line(box, row.name, 'h3');
    line(box, num(row.total) + ' 筆紀錄；已知名稱 ' + num(row.known) + '，非已知名稱 ' + num(row.unknown) + '（缺失 ' + num(row.missingCount) + '／枯木狀態 ' + num(row.statusCount) + '）');
    line(box, '來源名稱豐富度 S = ' + row.richness + '；Shannon H′ = ' + (row.shannon === null ? '無法計算' : num(row.shannon)));
    line(box, '最大類別占比 ' + pct(row.dominance) + '；集中度 Σpᵢ² = ' + (row.concentration === null ? '無法計算' : num(row.concentration)));
    line(box, '前三名（占已知名稱）：' + (row.top3.map(r => r.name + ' ' + pct(r.knownProportion)).join('、') || '無已知名稱'));
    line(box, '組成圖：筆數／占本單位全部紀錄；含缺失類別。', 'small');
    const chart = document.createElement('div'); chart.className = 'species-chart';
    for (const r of row.composition) {
      const item = document.createElement('div'); item.className = 'species-chart-row';
      line(item, r.name + ' · ' + num(r.count) + '（' + pct(r.proportion) + '）', 'span');
      const bar = document.createElement('i'); bar.style.width = pct(r.proportion); bar.style.backgroundColor = speciesColor(r.name); item.append(bar);
      item.title = '原始值：' + r.variants.map(v => v || '（空白）').join('、'); chart.append(item);
    }
    box.append(chart);
    line(box, 'H′ = −Σ pᵢ ln(pᵢ)，自然對數；pᵢ = 類別筆數／已知名稱筆數。缺失與枯木狀態不納入 S、H′、集中度與最大類別占比；僅描述分布，無生態好壞門檻。', 'small');
    line(box, '此篩選範圍未落官方區里 ' + num(omitted.total) + ' 筆（已知 ' + num(omitted.known) + '、缺失 ' + num(omitted.missingCount) + '、枯木 ' + num(omitted.statusCount) + '），未強制分派；公園名稱組成仍保留。公園依來源行政區＋名稱＋資料集分組，非公園邊界；缺名稱另列。', 'small');
    line(box, '只涵蓋所選來源的可繪製紀錄；不代表全臺北植被，未跨來源去重。來源名含混合類群／歧義，不拆成多株、不合併植物同物異名；調查日期與覆蓋不一致。點位非樹冠面積。', 'small');
    return box;
  }
  function render(bounds) {
    $('#species-status').textContent = '';
    const clearResults = () => { for (const id of ['species-summary','species-units','species-unit-detail','species-legend']) $('#' + id).replaceChildren(); };
    if (error) { clearResults(); $('#species-status').textContent = '分析載入失敗：' + error; $('#species-retry').hidden = false; return { count: 0, notice: '樹種分析資料載入失敗，可重試。' }; }
    $('#species-retry').hidden = ids().every(id => !state.errors.has(id));
    if (!ids().length || !regions || ids().some(id => !state.data.has(id) || state.errors.has(id))) {
      clearResults();
      $('#species-status').textContent = !ids().length ? '請選擇至少一個樹木來源。' : ids().some(id => state.errors.has(id)) ? '來源載入失敗，請按重試分析資料。' : '正在載入樹木與官方區里資料…';
      return { count: 0, notice: $('#species-status').textContent };
    }
    const datasets = ids().map(id => ({ id, features: state.data.get(id).features }));
    const ck = ids().join(',');
    if (catalogueKey !== ck) { catalog = aggregateSpecies(regions, datasets, 'district').summary.composition; catalogueKey = ck; renderCatalogue(); }
    // Composition/diversity always uses all species in each unit, not the spatial selection.
    const level = state.speciesLevel === 'distribution' ? 'district' : state.speciesLevel;
    const key = JSON.stringify([ids(), level, state.district, state.query]);
    try { if (cache?.key !== key) { cache = { key, ...aggregateSpecies(regions, datasets, level, { district: state.district, query: state.query }) }; $('#species-unit-detail').replaceChildren(); } }
    catch (e) { $('#species-status').textContent = e.message; return { count: 0, notice: e.message }; }
    $('#species-status').textContent = '篩選紀錄 ' + num(cache.summary.total) + '；已知 ' + num(cache.summary.known) + '／缺失 ' + num(cache.summary.missingCount) + '／枯木狀態 ' + num(cache.summary.statusCount) + '；未歸屬區里 ' + num(cache.assignmentOmissions.total) + '。' + ids().map(id => sourceName(id) + ' ' + num(cache.byLayer[id] ?? 0)).join('；');
    $('#species-summary').replaceChildren(detail({ ...cache.summary, name: '所選來源與篩選範圍（不依視野裁切）' }, cache.assignmentOmissions));
    const selected = state.speciesSelected;
    const overlaps = f => f.bbox[0] <= bounds.getEast() && f.bbox[2] >= bounds.getWest() && f.bbox[1] <= bounds.getNorth() && f.bbox[3] >= bounds.getSouth();
    if (state.speciesLevel !== 'distribution') {
      for (const row of cache.rows) {
        if (row.feature && !overlaps(row.feature)) continue;
        const color = row.top3.length ? speciesColor(row.top3[0].name) : speciesColor(UNKNOWN_SPECIES);
        if (!row.feature && row.features.length) {
          const lng = row.features.reduce((s,f) => s + f.geometry.coordinates[0], 0) / row.total;
          const lat = row.features.reduce((s,f) => s + f.geometry.coordinates[1], 0) / row.total;
          if (bounds.contains([lat,lng])) scene.use('species-park:' + row.key, key, () => L.circleMarker([lat,lng], { pane: 'density', radius: 7, color:'#fff', weight:1, fillColor:color, fillOpacity:.85 }).bindTooltip(tooltip(row.name + ' · ' + num(row.total) + ' 筆（紀錄座標平均點，非邊界）')).bindPopup(() => detail(row, cache.assignmentOmissions), { maxWidth:370 }));
        }
        if (row.feature) scene.use('species-unit:' + row.key, key, () => L.geoJSON(row.feature, { pane: 'density', style: { color: '#fff', weight: 1, fillColor: color, fillOpacity: .45 } }).bindTooltip(tooltip(row.name + ' · ' + num(row.total) + ' 筆 · S=' + row.richness)).bindPopup(() => detail(row, cache.assignmentOmissions), { maxWidth: 370 }));
      }
      $('#species-units').replaceChildren(...cache.rows.map(row => { const button = document.createElement('button'); button.textContent = row.name + ' · ' + num(row.total) + ' 筆 · 前三：' + (row.top3.map(r => r.name + ' ' + pct(r.knownProportion)).join('、') || '無') ; button.onclick = () => { $('#species-unit-detail').replaceChildren(detail(row, cache.assignmentOmissions)); if (row.feature) fitBounds(row.feature.bbox, 15); else { const b = row.features.reduce((a,f) => a ? [Math.min(a[0], f.bbox[0]), Math.min(a[1], f.bbox[1]), Math.max(a[2], f.bbox[2]), Math.max(a[3], f.bbox[3])] : [...f.bbox], null); fitBounds(b, 17); } }; return button; }));
    } else $('#species-units').replaceChildren();
    $('#species-unit-list').hidden = state.speciesLevel === 'distribution';
    const legendNames = state.speciesLevel === 'distribution' && selected.size ? catalog.filter(r => selected.has(r.name)) : catalog;
    $('#species-legend').replaceChildren(...legendNames.map(r => { const item = document.createElement('div'), swatch = document.createElement('i'); swatch.style.backgroundColor = speciesColor(r.name); item.append(swatch, document.createTextNode(r.name)); return item; }));
    return { legend: legendNames.slice(0, 8).map(r => ({ title: r.name, color: speciesColor(r.name) })), count: cache.summary.total, label: '所選來源・完整篩選範圍（非視野）', notice: state.speciesLevel === 'distribution' ? '依來源名稱著色；混合群聚以灰色顯示，放大可分辨。樹種多選僅篩選分布，不改組成／多樣性母體。' : '輪廓色為最多紀錄的已知來源名稱；無已知名稱為灰色。點擊區里或單位清單查看組成；公園僅依名稱分組，不繪製假邊界。' };
  }
  return { ensure, render, filter: f => !state.speciesSelected.size || state.speciesSelected.has(speciesName(f.properties.TreeType)), version: () => selectionVersion };
}
