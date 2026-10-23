import L from 'leaflet';

const $ = selector => document.querySelector(selector);
export function installBasemaps(map) {
  const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, zIndex: 1, className: 'street-tiles',
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  });
  // WMTS uses TileRow/TileCol (y/x), in the same EPSG:3857 matrix as Leaflet.
  const versions = { latest: 'PHOTO2', 2022: 'PHOTO2022', 2023: 'PHOTO2023', 2024: 'PHOTO2024', 2025: 'PHOTO2025' };
  const aerialUrl = year => import.meta.env.DEV
    ? `/__aerial-cache/${versions[year]}/{z}/{y}/{x}`
    : `https://wmts.nlsc.gov.tw/wmts/${versions[year]}/default/GoogleMapsCompatible/{z}/{y}/{x}`;
  const attribution = year => `正射航照（${year === 'latest' ? '最新拼接版' : year + ' 年度版'}） © <a href="https://maps.nlsc.gov.tw/S09SOA/pro/Wmts_ajax_main.jsp" target="_blank" rel="noopener">內政部國土測繪中心</a>`;
  const aerial = L.tileLayer(aerialUrl('latest'), {
    maxZoom: 19, maxNativeZoom: 19, zIndex: 2, className: 'aerial-tiles',
    bounds: [[21.4, 117.8], [26.5, 122.5]],
    attribution: attribution('latest'),
  });
  const layers = { street, aerial }, failed = new Set(), loading = new Set();
  let mode = 'street', opacity = 0.6, year = 'latest';
  function refreshStatus() {
    const active = Object.keys(layers).filter(id => map.hasLayer(layers[id]));
    const failures = active.filter(id => failed.has(id));
    $('#tile-error').hidden = !failures.length;
    $('#tile-error-text').textContent = `${failures.map(id => id === 'aerial' ? '航照' : '街道').join('、')}底圖部分圖磚載入失敗；可重試或切回街道，資料圖層仍可操作。`;
    $('#basemap-status').textContent = failures.length ? '底圖載入不完整' : active.some(id => loading.has(id)) ? '正在載入底圖…' : mode === 'street' ? 'OpenStreetMap 街道底圖' : `國土測繪中心正射航照 · ${year === 'latest' ? '最新拼接版' : year + ' 年度版'}`;
  }
  for (const [id, layer] of Object.entries(layers)) {
    layer.on('loading', () => { failed.delete(id); loading.add(id); refreshStatus(); });
    layer.on('tileerror', () => { failed.add(id); refreshStatus(); });
    layer.on('load', () => { loading.delete(id); refreshStatus(); });
  }
  function setMode(next) {
    mode = next;
    for (const value of ['street', 'aerial', 'blend']) $(`#basemap-${value}`).setAttribute('aria-pressed', value === mode);
    $('#aerial-controls').hidden = mode === 'street';
    $('#aerial-opacity-field').hidden = mode !== 'blend';
    if (mode === 'aerial') map.removeLayer(street);
    else if (!map.hasLayer(street)) street.addTo(map);
    if (mode === 'street') map.removeLayer(aerial);
    else {
      aerial.setOpacity(mode === 'blend' ? opacity : 1);
      if (!map.hasLayer(aerial)) aerial.addTo(map);
    }
    $('#map').dataset.basemap = mode;
    refreshStatus();
  }
  for (const value of ['street', 'aerial', 'blend']) $(`#basemap-${value}`).onclick = () => setMode(value);
  $('#aerial-year').onchange = event => {
    const next = event.target.value;
    if (!Object.hasOwn(versions, next) || next === year) return;
    const active = map.hasLayer(aerial);
    if (active) map.attributionControl.removeAttribution(aerial.options.attribution);
    year = next;
    aerial.options.attribution = attribution(year);
    if (active) map.attributionControl.addAttribution(aerial.options.attribution);
    failed.delete('aerial'); loading.delete('aerial');
    aerial.setUrl(aerialUrl(year));
    $('#aerial-version-note').textContent = year === 'latest'
      ? '最新拼接影像可能包含不同拍攝年份，請參考各區域浮水印。'
      : `${year} 年度更新版本；各區域可能沿用更早影像，並不代表全部在 ${year} 年拍攝。`;
    $('#map').dataset.aerialYear = year;
    refreshStatus();
  };
  $('#aerial-opacity').oninput = event => {
    opacity = Number(event.target.value) / 100;
    $('#aerial-opacity-value').value = `${event.target.value}%`;
    aerial.setOpacity(mode === 'blend' ? opacity : 1);
  };
  $('#overlay-visibility').onchange = event => map.getContainer().classList.toggle('hide-data-overlays', !event.target.checked);
  $('#aerial-detail').onclick = () => map.stop().setZoom(Math.max(17, map.getZoom()), { animate: false });
  $('#retry-basemap').onclick = () => {
    for (const [id, layer] of Object.entries(layers)) if (map.hasLayer(layer)) { failed.delete(id); layer.redraw(); }
    refreshStatus();
  };
  $('#fallback-street').onclick = () => setMode('street');
  setMode('street');
  $('#map').dataset.aerialYear = year;
}
