import L from 'leaflet';
import { createParkLoader,matchPark,createReviews,parkKey } from './data.js';
const $ = id => document.getElementById(id);
export function createParkBoundaries({map,loadParks,baseUrl}) {
  const load = createParkLoader({baseUrl});
  const group = L.layerGroup().addTo(map);
  map.createPane('parkOutlines'); map.getPane('parkOutlines').style.zIndex = 425;
  let storage; try { storage = window.localStorage; } catch { storage = {getItem:()=>null,setItem:()=>{throw new Error('瀏覽器禁止本機儲存');},removeItem:()=>{throw new Error('瀏覽器禁止本機儲存');}}; }
  const reviews = createReviews(storage);
  const renderer = L.svg({pane:'parkOutlines'});
  let snapshot, parks = [], selected, pending;
  const enabled = $('park-outline-enabled'), select = $('park-select'), status = $('park-boundary-status'), list = $('park-candidates');
  function showError(error) { status.textContent = '載入／儲存失敗：' + error.message; $('park-boundary-retry').hidden = false; }
  async function ensure() {
    if (snapshot) return;
    if (pending) return pending;
    pending = (async () => {
      status.textContent = '正在讀取本地快照…';
      const [data,official] = await Promise.all([load(),loadParks()]);
      if (!official?.length) throw new Error('官方公園點位未載入');
      snapshot = data; parks = official;
      select.replaceChildren(new Option('選擇官方公園點位',''),...parks.map((p,i) => new Option(p.properties.pm_name + ' · ' + p.properties.pm_regions,String(i))));
      $('park-boundary-source').textContent = '© OpenStreetMap contributors · ODbL 1.0 · 快照 '+snapshot.metadata.osmBase+' · '+snapshot.metadata.version;
      $('park-boundary-retry').hidden = true;
      status.textContent = '選擇公園，或點擊地圖上的官方公園點位。';
    })().finally(() => {pending = undefined;});
    return pending;
  }
  function render(fit = false) {
    group.clearLayers(); list.replaceChildren();
    if (!selected || !snapshot) return;
    const result = matchPark(selected,snapshot.features);
    status.textContent = selected.properties.pm_name+'：'+({matched:'同名位置候選（尚非官方確認）',ambiguous:'有歧義／名稱不一致，請逐一檢查',unmatched:'未匹配；不推測或補畫邊界'}[result.status]);
    status.dataset.match = result.status;
    for (const c of result.candidates) {
      const f = c.feature, review = reviews.get(selected,snapshot,f);
      if (enabled.checked) {
        const outline = L.geoJSON(f,{pane:'parkOutlines',interactive:false,renderer,style:{color:review?.decision === 'rejected' ? '#a0413a' : review?.decision === 'confirmed' ? '#087b50' : '#a44f04',weight:4,dashArray:review?.decision === 'confirmed' ? null : '8 5',fillOpacity:0.09,className:'park-candidate-outline'}}).addTo(group);
        outline.bindTooltip(f.properties.name || f.id);
      }
      const card = document.createElement('div'); card.className = 'park-candidate'; card.dataset.osmId = f.id;
      const title = document.createElement('strong'); title.textContent = (f.properties.name || 'OSM 未命名')+' · '+f.id;
      const info = document.createElement('p'); info.textContent = c.reason+'；距輪廓 '+c.distance+' m · OSM v'+f.properties.osmVersion+' / '+f.properties.osmTimestamp;
      const source = document.createElement('a'); source.href = 'https://www.openstreetmap.org/'+f.id; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = '查看 OSM 來源 ↗';
      const note = document.createElement('p'); note.className = 'park-review-state'; note.textContent = review ? (review.decision === 'confirmed' ? '已在此瀏覽器確認候選' : '已在此瀏覽器否決候選') : '本機尚未審查';
      card.append(title,info,source,note);
      for (const [decision,label] of [['confirmed','本機確認'],['rejected','本機否決']]) {
        const button = document.createElement('button'); button.textContent = label; button.dataset.decision = decision;
        button.onclick = () => { try { reviews.set(selected,snapshot,f,decision); render(); } catch(error) {showError(error);} };
        card.append(button);
      }
      list.append(card);
    }
    if (fit && enabled.checked && result.candidates.length) {
      const bounds = L.latLngBounds([]); group.eachLayer(l => bounds.extend(l.getBounds()));
      map.stop().fitBounds(bounds,{padding:[35,35],maxZoom:17,animate:false});
    } else if (fit && !result.candidates.length) map.stop().setView([...selected.geometry.coordinates].reverse(),17,{animate:false});
  }
  async function selectPark(park) {
    try { enabled.checked = true; await ensure(); selected = parks.find(p => parkKey(p) === parkKey(park)) || park; select.value = String(parks.indexOf(selected)); render(true); }
    catch(error) {showError(error);}
  }
  enabled.onchange = async () => { try { if (enabled.checked) await ensure(); render(true); } catch(error) {showError(error);} };
  select.onchange = () => { selected = parks[Number(select.value)]; if (!select.value) selected = null; render(true); };
  // Selecting the control loads only once, never on map movement.
  select.onfocus = () => ensure().catch(showError);
  $('park-boundary-retry').onclick = () => ensure().then(() => render()).catch(showError);
  $('park-review-reset').onclick = () => { try { reviews.reset(); render(); $('park-review-feedback').textContent = '已清除此瀏覽器的所有公園審查。'; } catch(error) {showError(error);} };
  $('park-review-export').onclick = () => {
    const blob = new Blob([JSON.stringify(reviews.export(),null,2)],{type:'application/json'}), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'park-boundary-local-reviews.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  // Popupopen is an actual marker selection, not popup creation during rendering.
  map.on('popupopen',event => { const key = event.popup.getElement()?.querySelector('[data-official-park-key]')?.dataset.officialParkKey; if (key) loadParks().then(ps => { const park = ps.find(p => parkKey(p) === key); if (park) selectPark(park); }).catch(showError); });
  return {selectPark};
}
