import L from 'leaflet';
import { aggregateRegions } from './analysis.js';
import { densityColor } from './density.js';
import { matches } from './explorer.js';
import { AnalysisCache } from './analysis-cache.js';

const $ = selector => document.querySelector(selector);
const number = n => n.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
const overlaps = (bbox, bounds) => bbox[0] <= bounds.getEast() && bbox[2] >= bounds.getWest() && bbox[1] <= bounds.getNorth() && bbox[3] >= bounds.getSouth();
const line = (box, text, tag = 'p') => { const el = document.createElement(tag); el.textContent = text; box.append(el); return el; };

export function createAnalysis({ state, map, scene, visibleLayerIds, loadLayer, scheduleRender }) {
  let regions, regionPromise, regionError, regionCache;
  let worker, token = 0;
  const resultCache = new AnalysisCache(), jobs = new Map();
  const sentTrees = new Set();
  let sentSidewalks;
  const sourceLink = 'https://data.taipei/dataset/detail?id=6b17b31d-4e16-495e-95b1-9fd1f47c80d8';
  const selected = () => visibleLayerIds();
  const ready = () => selected().length && selected().every(id => state.data.has(id) && !state.errors.has(id));
  function showStatus(text, retry) {
    $('#analysis-status').replaceChildren();
    line($('#analysis-status'), text, 'span');
    if (retry) {
      const button = line($('#analysis-status'), '重試分析資料', 'button'); button.className = 'retry-button'; button.onclick = () => { resultCache.retry(); ensure(); scheduleRender(); };
    }
  }
  async function ensure() {
    if (state.analysisShape === 'grid' || state.mode !== 'density') return;
    if (state.analysisShape === 'sidewalk') {
      const definition = state.definitions.find(d => d.id === 'sidewalks');
      if (definition) await loadLayer(definition);
      scheduleRender(); return;
    }
    if (regions || regionPromise) return regionPromise;
    regionError = null;
    regionPromise = (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/regions.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.treeSnapshot !== state.snapshot) throw new Error('樹木快照與區里分析版本不同，請執行 npm run boundaries:refresh。');
        if (data.features?.length !== 456 || data.districts?.length !== 12) throw new Error('區里資料格式異常');
        regions = data;
      } catch (error) { regionError = error.message; }
      finally { regionPromise = null; scheduleRender(); }
    })();
    return regionPromise;
  }
  function startWorker() {
    if (!worker) {
      worker = new Worker(new URL('./sidewalk-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        const job = jobs.get(data.token);
        if (!job) return;
        jobs.delete(data.token);
        resultCache.complete(job.key, job.indices, data.rows, data.error);
        scheduleRender();
      };
      worker.onerror = event => { resultCache.failAll(event.message || '分析工作執行失敗'); jobs.clear(); worker.terminate(); worker = null; sentTrees.clear(); sentSidewalks = null; scheduleRender(); };
    }
    for (const id of selected()) if (!sentTrees.has(id)) {
      worker.postMessage({ type: 'trees', id, coordinates: state.data.get(id).features.map(f => f.geometry.coordinates) }); sentTrees.add(id);
    }
    const sidewalks = state.data.get('sidewalks');
    if (sentSidewalks !== sidewalks) {
      worker.postMessage({ type: 'sidewalks', features: sidewalks.features.map(f => ({ geometry: f.geometry, properties: { SW_LENG_ItemValue: f.properties.SW_LENG_ItemValue } })) });
      sentSidewalks = sidewalks;
    }
  }
  function renderRegions(bounds) {
    if (!regions) {
      const notice = regionError ? `區里資料載入失敗：${regionError}` : '正在載入官方區里邊界…';
      showStatus(notice, !!regionError); return { count: 0, notice };
    }
    const ids = selected(), key = JSON.stringify([ids, state.analysisShape, state.district, state.query]);
    if (regionCache?.key !== key) {
      try { regionCache = { key, ...aggregateRegions(regions, ids.map(id => ({ id, features: state.data.get(id).features })), state.analysisShape, { district: state.district, query: state.query }) }; }
      catch (error) { showStatus(error.message); return { count: 0, notice: error.message }; }
    }
    const rows = regionCache.rows.filter(row => overlaps(row.feature.bbox, bounds));
    for (const row of rows) {
      const p = row.feature.properties;
      scene.use(`region:${p.id}`, key, () => L.geoJSON(row.feature, { pane: 'density', style: { color: '#fff', weight: 1.2, opacity: 0.8, fillColor: densityColor(row.density), fillOpacity: state.heatOpacity } })
        .bindTooltip(`${p.district === p.name ? p.name : p.district + p.name} · ${number(row.density)} 筆／公頃`)
        .bindPopup(() => {
          const box = document.createElement('div'); box.className = 'density-popup admin-popup';
          line(box, p.district === p.name ? p.name : p.district + p.name, 'h3');
          line(box, `${number(row.count)} 筆樹木紀錄 · ${number(p.area / 10000)} 公頃`);
          line(box, `${number(row.density)} 筆／公頃（完整行政範圍）`);
          for (const id of ids) line(box, `${state.definitions.find(d => d.id === id).title}：${number(row.byLayer[id] ?? 0)} 筆`);
          line(box, '套用樹木搜尋條件；未以視野裁切面積。行政面積含山地等非道路空間，低紀錄密度不等於缺樹或樹蔭不足。', 'small');
          const a = line(box, '官方里界來源 ↗', 'a'); a.href = sourceLink; a.target = '_blank'; a.rel = 'noopener'; return box;
        }, { maxWidth: 320 }), state.heatOpacity, layer => layer.setStyle({ fillOpacity: state.heatOpacity }));
    }
    showStatus(`${regions.features.length} 里／${regions.districts.length} 區 · ${regionCache.unmatched} 筆符合條件但未落在官方邊界，未強制歸屬。`);
    $('#cell-area').textContent = `依${state.analysisShape === 'district' ? '區' : '里'}實際面積 · ${rows.length} 個範圍與視野相交`;
    $('#density-legend').dataset.cells = rows.length;
    return { count: rows.reduce((a, row) => a + row.count, 0), label: '與視野相交區里・完整區域樹木紀錄', notice: rows.length ? '行政區里密度 · 點擊輪廓查看完整區域筆數與面積；這是紀錄密度，不是充足性標準。' : '目前視野沒有符合的行政範圍。' };
  }
  function renderSidewalks(bounds) {
    const dataset = state.data.get('sidewalks');
    if (!dataset) { const notice = state.errors.has('sidewalks') ? '人行道資料載入失敗，請重試。' : '正在載入人行道輪廓…'; showStatus(notice, state.errors.has('sidewalks')); return { count: 0, notice }; }
    const features = dataset.index.search({ minX: bounds.getWest(), minY: bounds.getSouth(), maxX: bounds.getEast(), maxY: bounds.getNorth() }).map(item => item.feature).filter(f => matches(f, state.district, state.query));
    if (!dataset.analysisIndices) dataset.analysisIndices = new Map(dataset.features.map((f, i) => [f, i]));
    const indices = features.map(f => dataset.analysisIndices.get(f)).sort((a, b) => a - b);
    const options = { radius: state.treeRadius, target: state.treeTarget, coverageGoal: state.coverageTarget };
    const key = JSON.stringify([selected(), options]);
    const cached = resultCache.get(key);
    if (cached.error) { showStatus(`人行道分析失敗：${cached.error}`, true); return { count: 0, notice: '人行道分析失敗，可按左側重試。' }; }
    const missing = resultCache.request(key, indices);
    if (missing.length) {
      startWorker(); token++;
      jobs.set(token, { key, indices: missing });
      worker.postMessage({ type: 'analyze', token, ids: selected(), indices: missing, options });
    }
    const results = indices.flatMap(i => cached.rows.has(i) ? [cached.rows.get(i)] : []);
    const waiting = indices.length - results.length;
    for (const row of results) {
      const feature = dataset.features[row.index], name = feature.properties.NAME_Road || feature.properties.ID || '人行道';
      const color = row.score === null ? '#a1a69d' : densityColor(row.score * 20);
      scene.use(`sidewalk:${row.index}`, key, () => L.geoJSON(feature, { pane: 'density', style: { color, weight: map.getZoom() < 15 ? 1.2 : 3, opacity: 1, fillColor: color, fillOpacity: state.heatOpacity } })
        .bindTooltip(`${name} · ${row.score === null ? '無法評分' : row.score >= 1 ? '達探索目標' : '低於探索目標'}`)
        .bindPopup(() => {
          const box = document.createElement('div'); box.className = 'density-popup sidewalk-popup';
          line(box, `${name} · ${feature.properties.SW_DIRECT || ''}`, 'h3');
          line(box, `編號：${feature.properties.ID ?? '未提供'}；${feature.properties.PSTART ?? ''} → ${feature.properties.PEND ?? ''}`);
          line(box, `官方長度：${row.length === null ? '未提供，灰色不評分' : number(row.length) + ' 公尺'}`);
          line(box, `${state.treeRadius} 公尺內：${number(row.count)} 筆樹木；每 100 公尺 ${row.per100m === null ? '無法計算' : number(row.per100m)} 筆`);
          line(box, `輪廓鄰近率：${row.coverage === null ? '無法計算' : number(row.coverage * 100) + '%'}（${row.samples} 個加權取樣點）`);
          line(box, `探索目標：每百公尺 ${state.treeTarget} 筆、輪廓鄰近率 ${state.coverageTarget * 100}%`);
          line(box, `判讀：${row.score === null ? '資料不足' : row.score >= 1 ? '兩項均達探索目標' : '至少一項低於探索目標'}${row.score === null ? '' : ' · 達標比 ' + number(row.score * 100) + '%'}`);
          line(box, '以輪廓距離與外環每約 10 公尺取樣估算，不是中心線或樹蔭覆蓋率。同一棵樹可能鄰近多段人行道，未判斷道路阻隔；搜尋只篩選人行道，跨區鄰樹仍會納入。', 'small'); return box;
        }, { maxWidth: 340 }), `${state.heatOpacity}:${map.getZoom() < 15}`, layer => layer.setStyle({ fillOpacity: state.heatOpacity, weight: map.getZoom() < 15 ? 1.2 : 3 }));
    }
    const unknown = results.filter(row => row.score === null).length;
    if (waiting) showStatus(`已完成 ${results.length} 段，正在背景分析新增 ${waiting} 段人行道…`);
    else showStatus(`${results.length} 段已分析 · ${unknown} 段缺有效長度或輪廓，灰色不評分。探索設定非官方標準。`);
    $('#cell-area').textContent = `距離 ${state.treeRadius} m · ${state.treeTarget} 筆／100 m · 鄰近率目標 ${state.coverageTarget * 100}%`;
    $('#density-legend').dataset.cells = results.length;
    return { count: results.length, label: '目前視野內・完成分析的人行道', unit: '段人行道', notice: waiting ? `保留已完成的 ${results.length} 段，正在計算新增 ${waiting} 段人行道。` : '人行道分析 · 紅低於目標、綠達探索目標、灰資料不足 · 點擊查看兩項指標。' };
  }
  function render(bounds) {
    if (!ready()) { showStatus(selected().length ? '請等候勾選的樹木圖層載入；資料未齊前不判讀。' : '請勾選行道樹或公園樹木。'); return { count: 0, notice: '請勾選並載入樹木資料。' }; }
    return state.analysisShape === 'sidewalk' ? renderSidewalks(bounds) : renderRegions(bounds);
  }
  return { ensure, render, boundaries: () => regions && (state.analysisShape === 'district' ? regions.districts : regions.features).filter(f => !state.district || f.properties.district === state.district) };
}
