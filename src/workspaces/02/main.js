import {applySocialMetrics,GAME_SHA256} from './social-metrics.js';
import {compositeRating,villageFitPadding,RATING_POLICY} from './social-state.js';
import L from 'leaflet';
import { createVillageTrees } from './village-trees.js';
import './village-trees.css';
import { installRecordLayers } from './record-layers.js';
import './record-layers.css';
import { interiorAnchor } from './hover-anchor.js';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { createCapabilityRadar } from './capability-radar.js';
import './capability-radar.css';
import { CAPABILITIES, RADAR_CAPABILITIES, dominantCapability, TIE_COLOR, NEUTRAL_COLOR } from './domain.js';
const $ = id => document.getElementById(id), base = import.meta.env.BASE_URL;
let data, regions, map, group, hoverRenderer, selected, recordLayers, villageTrees, visible = [], layers = new Map();
function el(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; }
const fmt = (v, digits = 0) => Number.isFinite(v) ? v.toLocaleString('zh-TW', { maximumFractionDigits: digits }) : 'N/A';
function card(title, score, raw, note) {
  const n = el('article', undefined, 'card'); n.append(el('h3', title));
  const number = el('p', score === null ? 'N/A' : score + ' / 100', 'score'); n.append(number);
  if (score !== null) { const meter = el('meter'); meter.min = 0; meter.max = 100; meter.value = score; meter.setAttribute('aria-label', title + '相對分數'); n.append(meter); }
  n.append(el('p', raw, 'raw'), el('p', note, 'caveat')); return n;
}
let level='overview',overviewCamera,switching=false,suppressPreview=false;
function setLevel(value){level=value;$('stage').dataset.level=value;}
function fitVillage() {
  if (!selected) return;
  const toolbar = Math.ceil(document.querySelector('.toolbar').getBoundingClientRect().bottom + 12);
  if(popup)popup.options.maxHeight=Math.max(50,Math.min(340,(innerHeight-toolbar-50)*.5-40));
  popup?.update();
  const sidebar = level === 'tree'
    ? Math.min(innerWidth < 761 ? Math.max(145, innerWidth * .43) : 360, innerWidth * .48) : 0;
  const bubble = popup?.getElement()?.getBoundingClientRect().height || 280;
  if ($('species-panel')) $('species-panel').style.top = toolbar + 'px';
  map.fitBounds(layers.get(selected).getBounds(), {
    animate: false, maxZoom: 18,
    ...villageFitPadding(innerWidth, innerHeight, {bubble: bubble + 18, sidebar, toolbar})
  });
}
function clearSelection() {
  if (switching) return;
  selected = null; pinnedTreeVillage = null; setLevel('overview');
  villageTrees?.closeRecord(false); shownTreeKey = null; hideHover();
  $('passport-toggle').hidden = true;
  panelIds.forEach(id => closePanel(id, false));
  layers.forEach((layer, id) => styleVillage(id));
  if (overviewCamera) map.setView(overviewCamera.center, overviewCamera.zoom, {animate: false});
  // Returning keyboard focus must not silently start a fresh hover tree request.
  suppressPreview = true;
  const target = popupFocus;
  if (target?.isConnected && !target.closest('[hidden]')) target.focus({preventScroll: true});
  else $('finder-toggle').focus({preventScroll: true});
  suppressPreview = false;
}
let popup, popupFocus, hovered, activeBasemap, basemapKind = 'street';
function radar(v,size=170,compact=false) { const chart=createCapabilityRadar({axes:RADAR_CAPABILITIES.map(c=>({...c,label:c.key==='activity'?'回報活躍度（DEMO）':c.label,value:c.unavailable?null:v.scores[c.key]})),missingAtZero:true,size,compact,label:'六項能力：含鳥蟲／回報 DEMO 模擬'});chart.querySelector('.radar-units').textContent='0–100：快照3項＋原生代理＋DEMO 2項；非生態評估';return chart; }
function styleVillage(id,hover=false) { layers.get(id)?.setStyle({color:id===selected?'#172f35':'#50616a',weight:id===selected?4:1,fillOpacity:hover?.78:id===selected?.70:.48}); }
const hoverAnchors = new Map();
let previewTimer,pinnedTreeVillage=null,shownTreeKey=null;
function showVillageTrees(id,preview=false){clearTimeout(previewTimer);if(!villageTrees)return;const key=id+':'+preview;if(shownTreeKey===key)return;shownTreeKey=key;$('village-trees-controls').hidden=false;villageTrees.show(id,{preview});}
function restorePinnedTrees(){clearTimeout(previewTimer);if(!villageTrees)return;if(pinnedTreeVillage)showVillageTrees(pinnedTreeVillage,false);else{shownTreeKey=null;villageTrees.clear();$('village-trees-controls').hidden=true;}}
function hideHover(keepTrees=false) { $('hover-preview')?.remove(); if(hovered) {styleVillage(hovered);hovered=null;} if(!keepTrees)restorePinnedTrees(); }
function positionHover() {
 const n=$('hover-preview'), anchor=hoverAnchors.get(hovered);if(!n||!anchor)return;
 const p=map.latLngToLayerPoint(anchor);n.setAttribute('transform','translate('+p.x+','+p.y+')');
}
function showHover(v,keyboard=false) {
 if(suppressPreview||level!=='overview'||map?.getContainer().querySelector('.leaflet-popup') || (!keyboard&&!matchMedia('(hover:hover)').matches))return;
 if(hovered===v.id)return;
 hideHover();const layer=layers.get(v.id),path=layer.getLayers()[0]?.getElement();if(!path)return;
 if(!hoverAnchors.has(v.id)) {
  const geometry=layer.toGeoJSON().features[0].geometry;
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  const projected=polygons.map(p=>p.map(r=>r.map(([lng,lat])=>{const p=map.project([lat,lng],0);return [p.x,p.y];})));
  const point=interiorAnchor(projected);if(!point)return;hoverAnchors.set(v.id,map.unproject(point,0));
 }
 hovered=v.id;styleVillage(v.id,true);previewTimer=setTimeout(()=>{if(!map.getContainer().querySelector('.leaflet-popup'))showVillageTrees(v.id,true);},180);
 const ns='http://www.w3.org/2000/svg', n=document.createElementNS(ns,'g');n.id='hover-preview';n.classList.add('polygon-hover','radar-chart');n.dataset.village=v.id;n.setAttribute('role','img');n.setAttribute('aria-label',v.district+v.name+'能力概覽');
 const text=(value,y,cls)=>{const t=document.createElementNS(ns,'text');t.textContent=value;t.setAttribute('x','0');t.setAttribute('y',y);t.setAttribute('text-anchor','middle');t.setAttribute('class',cls);n.append(t);return t;};
 text(v.district+'・'+v.name,-12,'hover-name');
 const rating=compositeRating(v.scores);n.dataset.rating=rating===null?'N/A':rating.toFixed(1);n.dataset.ratingPolicy=RATING_POLICY.version;
 const foreign=document.createElementNS(ns,'foreignObject');foreign.setAttribute('x','-130');foreign.setAttribute('y','0');foreign.setAttribute('width','260');foreign.setAttribute('height','65');const stars=el('div',undefined,'hover-stars');stars.setAttribute('aria-label','綜合星等（含模擬資料） '+(rating===null?'N/A':rating.toFixed(1)+' / 5'));const back=el('span','☆☆☆☆☆','stars-back'),front=el('span','★★★★★','stars-front');front.style.width=(rating===null?0:rating/5*100)+'%';const glyph=el('span',undefined,'stars-glyph');glyph.append(back,front);stars.append(glyph,el('span',rating===null?'N/A':rating.toFixed(1)+' / 5','stars-number'),el('small','含模擬資料 · 鳥蟲／回報 DEMO','hover-demo')); foreign.append(stars);n.append(foreign);
 hoverRenderer._rootGroup.append(n);positionHover();
}
function openDetails(trigger,advice=false) {openPanel('passport',trigger);$('planting-advice').hidden=!advice;$('passport').querySelector('.panel-scroll').scrollTop=0;}
function showOverview(v,latlng,trigger) {
 hideHover();panelIds.forEach(id=>closePanel(id,false));popupFocus=trigger||$('passport-toggle');
 const content=el('section',undefined,'village-overview');content.setAttribute('aria-label',v.district+v.name+'概覽');
 content.append(el('h2',v.district+'・'+v.name),radar(v,105,true),el('p',dominantCapability(v.scores).text,'overview-strength'));
 const summary=el('p',undefined,'overview-summary');summary.append(el('span','管理樹 '+fmt(v.trees)+' 筆 · 保護名冊 '+fmt(v.protected)+' 筆'),el('br'),el('span','來源名稱 '+fmt(v.richness)+' 類'),el('br'),el('span','快照相對分數；密度為代理指標'));content.append(summary);const rating=compositeRating(v.scores);content.append(el('p','綜合星等（含模擬資料） '+(rating===null?'N/A':rating.toFixed(1)+' / 5')+'；六項有效能力等權平均 ÷ 20，非使用者評論。','rating-note'));
 const low=CAPABILITIES.filter(c=>Number.isFinite(v.scores[c.key])).sort((a,b)=>v.scores[a.key]-v.scores[b.key])[0]; if(low && v.scores[low.key]<Math.max(...CAPABILITIES.map(c=>v.scores[c.key]))) content.append(el('p',low.label+'分數低於本里其他指標；仍須考量面積與調查覆蓋。','overview-state')); const actions=el('div',undefined,'overview-actions');for(const [text,advice] of [['查看細節',false],['種樹建議',true]]) {const b=el('button',text);b.type='button';b.onclick=()=>openDetails(b,advice);actions.append(b);}content.append(actions);
 L.DomEvent.disableClickPropagation(content);L.DomEvent.disableScrollPropagation(content);
 switching=true;if(popup)map.closePopup(popup);switching=false;
 popup=L.popup({autoClose:false,closeOnClick:false,autoPan:false,className:'village-popup',maxWidth:330,minWidth:Math.min(270,innerWidth-72),maxHeight:Math.max(130,Math.min(510,innerHeight-205)),autoPanPaddingTopLeft:[16,135],autoPanPaddingBottomRight:[16,35],closeOnEscapeKey:false}).setLatLng([layers.get(v.id).getBounds().getNorth(),layers.get(v.id).getBounds().getCenter().lng]).setContent(content).openOn(map);
 popup.on('remove',()=>{if(!switching)clearSelection();});
 fitVillage();
}
function switchBasemap(kind,retry=false) {
 if(activeBasemap)map.removeLayer(activeBasemap);basemapKind=kind;$('basemap').value=kind;$('tile-retry').hidden=true;
 $('imagery-note').textContent=kind==='aerial'?'國土測繪中心最新拼接航照；非即時影像，未提供精確攝影日期。':'OpenStreetMap 街道圖';
 const layer=L.tileLayer(kind==='aerial'?'https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}':'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:21,maxNativeZoom:19,attribution:kind==='aerial'?'© <a href="https://www.nlsc.gov.tw/">內政部國土測繪中心</a>':'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'});
 activeBasemap=layer;let failed=false;layer.on('tileerror',()=>{if(failed||activeBasemap!==layer)return;failed=true;if(kind==='aerial'){switchBasemap('street');$('tile-status').textContent='航照載入失敗，已回到街道圖。';$('tile-retry').textContent='重試航照';}else{$('tile-status').textContent='街道底圖載入失敗；里界仍可操作。';$('tile-retry').textContent='重試底圖';}$('tile-retry').hidden=false;});
 $('tile-status').textContent='';layer.addTo(map);
}
function select(id, fit = true, latlng, trigger = document.activeElement) {
  const v = data.villages.find(r => r.id === id); if (!v) return; if(level==='overview')overviewCamera={center:map.getCenter(),zoom:map.getZoom()};switching=true;villageTrees?.closeRecord(false);switching=false;setLevel('village');selected = id;pinnedTreeVillage=id;showVillageTrees(id,false);
  layers.forEach((l,key)=>styleVillage(key));
  map.stop(); map.invalidateSize({pan:false,animate:false});
  layers.get(id)?.bringToFront();
  showOverview(v,latlng,trigger);
  const strongest = dominantCapability(v.scores); $('strongest').textContent = strongest.text; $('strongest').style.borderColor = strongest.color;
  $('passport-toggle').hidden = false;
  $('passport').querySelector('.panel-scroll').scrollTop = 0;
  $('village-title').textContent = v.district + '・' + v.name;
  $('advice-evidence').textContent='本里快照：管理樹 '+fmt(v.trees)+' 筆、來源名稱 '+fmt(v.richness)+' 類、保護名冊 '+fmt(v.protected)+' 筆。先核對現場紀錄與遮蔭缺口；名稱類別不等於原生物種。';
  $('village-meta').textContent = '里全面積 ' + fmt(v.areaKm2, 3) + ' km²｜固定參考母體：全臺北456里｜快照 ' + data.treeSnapshot.slice(0,10);
  $('cards').replaceChildren(
    card('01 管理樹木密度 · 代理指標', v.scores.treeDensity, fmt(v.treeDensity,1) + ' 筆/km²｜' + fmt(v.trees) + ' 筆 ÷ ' + fmt(v.areaKm2,3) + ' km²', '不是綠覆率、樹冠面積或全里樹木普查。'),
    card('02 官方受保護樹木紀錄', v.scores.protectedDensity, fmt(v.protectedDensity,1) + ' 筆/km²｜名冊 ' + fmt(v.protected) + ' 筆 ÷ ' + fmt(v.areaKm2,3) + ' km²', '文化局名冊空間歸屬；非候選大樹。資料期間較舊，法律現況須查證。'),
    card('03 管理樹木名稱豐富度', v.scores.richness, fmt(v.richness) + ' 類｜有名稱 ' + fmt(v.knownNames) + '/' + fmt(v.trees) + ' 筆', 'Shannon ' + fmt(v.shannon,3) + '；最大類別占比 ' + (v.dominance === null ? 'N/A' : fmt(v.dominance*100,1) + '%') + '。未知 ' + v.missingNames + '、枯木 ' + v.deadStatus + ' 筆。非全植物物種數；受取樣量影響。'),
    card('04 原生比例 · 藍圖 PROXY', v.scores.nativeShare,fmt(v.socialMetrics.native.matched)+' / '+fmt(v.trees)+' 筆（全部管理樹分母）','只比對藍圖19個名稱；未列者為本原型假設非原生，不是植物學事實。未知 '+v.socialMetrics.native.unknown+'、枯木 '+v.socialMetrics.native.dead+' 筆仍在分母；API 原生旗標不計分。'),
    card('05 鳥類／昆蟲 · DEMO 模擬',v.scores.birdInsect,'seeded DEMO 指派分數','非真實觀測、圖鑑數量或生態品質；固定種子僅供介面展示。'),
    card('06 回報活躍度 · DEMO 模擬',v.scores.activity,fmt(v.socialMetrics.activity.reportedCount)+' / '+fmt(v.socialMetrics.activity.dueCount)+' 筆 · 7日模擬回報／應回報樹數','7日模擬回報數 ÷ 應回報樹數 ×100；2026-10-18–24。沒有真實市民回報、上傳或使用者評論。'),
  );
  [...$('cards').children].forEach((n,i) => { const c = CAPABILITIES[i]; n.style.setProperty('--capability', c?.color || NEUTRAL_COLOR); if(c) n.dataset.capability = c.key; });
  document.querySelectorAll('#villages button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
}
function filter() {
  hideHover();
  const district = $('district').value, query = $('search').value.trim();
  visible = data.villages.filter(v => (!district || v.district === district) && (v.district + v.name).includes(query));
  const ids = new Set(visible.map(v => v.id));
  if(pinnedTreeVillage&&!ids.has(pinnedTreeVillage)){map.closePopup(popup);clearSelection();}
  layers.forEach((l,id) => { if (ids.has(id)) { if (!group.hasLayer(l)) group.addLayer(l); } else group.removeLayer(l); });
  $('result-count').textContent = visible.length + ' 里符合條件';
  $('villages').replaceChildren(...visible.map(v => { const li = el('li'), b = el('button', v.district + '・' + v.name); b.type = 'button'; b.dataset.id = v.id; b.setAttribute('aria-pressed', String(v.id === selected)); b.onclick = () => select(v.id); li.append(b); return li; }));
  if (level==='overview' && visible.length && district) map.fitBounds(group.getBounds(), { animate: false, padding: [15,15] });
}
function provenance() {
  const p = $('provenance'); p.replaceChildren();p.append(el('p','六項綜合星等：原有三項快照相對分數＋藍圖原生比例代理＋鳥蟲、回報兩項 seeded DEMO；有效值等權平均 ÷20。原生代理：藍圖19名稱相符紀錄／全部管理樹，未列者假設非原生僅供原型，不是分類事實。回報活躍度：7日模擬已回報／應回報樹數；零分母為0。沒有真實公民回報。'));
  p.append(el('p', '管理樹快照：' + data.treeSnapshot + '；里界擷取：' + data.boundaryFetchedAt + '；彙整：' + data.preparedAt));
  p.append(el('p', '管理樹162,369筆＝里內162,321＋未歸屬48。以實際座標重新驗證全部歸屬與來源SHA-256；有來源名稱不等於已校對物種。'));
  function link(text, url) { const a = el('a', text); a.href = url; a.target = '_blank'; a.rel = 'noopener'; p.append(a, el('br')); }
  link(data.treeSource.agency + '・管理樹來源', data.treeSource.url); link('臺北市官方里界來源', data.boundarySource);
  for (const s of data.sources) { const a = s.audit; p.append(el('p', s.agency + '｜' + s.title + '｜下載 ' + (s.fetchedAt || '快取（擷取時間未留存）') + '｜原始 ' + a.raw + '、無效座標 ' + a.invalidCoordinates + '、重複 ' + a.duplicates + '、有效唯一 ' + a.uniqueValid + '、里內 ' + a.assigned + '、未歸屬 ' + a.unmatched + '。' + (s.key === 'protected' ? '檔案更新2026-03-23，metadata資料涵蓋至2023-04-11；胸徑單位公尺，未用於分數。' : '來源更新日期未確認；未宣稱即時。以地址＋座標去除完全重複。'))); link('來源：' + s.title, s.source); link(s.license, s.licenseUrl); }
  link('管理樹／里界：政府資料開放授權條款', data.treeSource.licenseUrl);
}
async function load() {
  hideHover();
  $('retry').hidden = true; $('status').textContent = '正在整理地圖與里環境護照…';
  try {
    const fetchJSON = async name => { const r = await fetch(base + 'data/' + name, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error('HTTP ' + r.status); const bytes = await r.arrayBuffer(); return { bytes, json: JSON.parse(new TextDecoder().decode(bytes)) }; };
    const [d,r,m] = await Promise.all([fetchJSON('village-game.json'), fetchJSON('regions.json'),fetchJSON('social-metrics.json')]); const gameHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',d.bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(gameHash!==GAME_SHA256)throw Error('管理樹統計檔案 SHA 不符');data=applySocialMetrics(d.json,m.json);regions=r.json;
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', r.bytes))].map(n => n.toString(16).padStart(2,'0')).join('');
    if (data.schemaVersion !== 1 || data.villages.length !== 456 || regions.features.length !== 456 || regions.treeSnapshot !== data.treeSnapshot || digest !== data.inputHashes['regions.json']) throw new Error('快照或里界版本不一致');
    const ids = new Set(regions.features.map(f => f.properties.id)); if (new Set(data.villages.map(v => v.id)).size !== 456 || data.villages.some(v => !ids.has(v.id))) throw new Error('里代碼不一致');
    if (!map) {
      map = L.map('map', { scrollWheelZoom: true, zoomControl: false, zoomAnimation: false, fadeAnimation: false,zoomSnap:0 }).setView([25.06,121.55],11);
      switchBasemap('street');
      $('basemap').onchange=()=>switchBasemap($('basemap').value);
      $('tile-retry').onclick=()=>switchBasemap($('tile-retry').textContent.includes('航照')?'aerial':basemapKind,true);
      L.control.zoom({ position: 'bottomleft' }).addTo(map);
      group = L.featureGroup().addTo(map);
      const hoverPane=map.createPane('village-hover');hoverPane.style.zIndex='490';hoverPane.style.pointerEvents='none';
      hoverRenderer=L.svg({pane:'village-hover',padding:0.5}).addTo(map);
      hoverRenderer._container.style.pointerEvents='none';
      recordLayers=installRecordLayers({map,host:$('record-layers-list'),base,onFeatureOpen:()=>{hideHover();panelIds.forEach(id=>closePanel(id,false));}});
      villageTrees=createVillageTrees({map,base,statusHost:$('village-tree-status'),expectedSnapshot:data.treeSnapshot,expectedSourceHashes:data.inputHashes,villageInfo:id=>data.villages.find(v=>v.id===id),onFeatureClose:()=>{if(!switching&&selected){setLevel('village');fitVillage();}},onFeatureOpen:({villageId,preview}={})=>{if(preview){select(villageId);return;}if(villageId&&selected!==villageId)select(villageId);pinnedTreeVillage=villageId;shownTreeKey=villageId+':false';hideHover(true);panelIds.forEach(id=>closePanel(id,false));setLevel('tree');fitVillage();},onState:state=>{recordLayers.setExcludedTrees(state.phase==='ready'?state.records:[]);}});
      recordLayers.setPriorityHitTest(event=>villageTrees.containsEvent?.(event)||false);
      map.on('resize',()=>{if(selected)fitVillage();});map.on('zoom viewreset moveend',positionHover);map.on('dragstart zoomstart',()=>hideHover());
    }
    hideHover();hoverAnchors.clear();group.clearLayers(); layers = new Map();
    const villagesById = new Map(data.villages.map(v => [v.id,v]));
    regions.features.forEach(f => {
      const v = villagesById.get(f.properties.id), strength = dominantCapability(v.scores);
      const l = L.geoJSON(f, { style: { color: '#50616a', weight: 1, fillColor: strength.color, fillOpacity: .48 } });
      l.on('mouseover',()=>showHover(v));
      l.on('mouseout',()=>hideHover());
      l.on('click',e=>select(v.id,true,e.latlng,e.originalEvent?.target));
      l.eachLayer(path => {
        path.on('add', () => { const node = path.getElement(); node.dataset.village = v.id; node.setAttribute('tabindex','0'); node.setAttribute('role','button'); node.setAttribute('aria-label',v.district + v.name + '｜' + strength.text);
          node.onfocus=()=>showHover(v,true);node.onblur=()=>hideHover();
          node.onkeydown = e => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); select(v.id,true,undefined,node); popup?.getElement()?.querySelector('button')?.focus({preventScroll:true}); } };
        });
      });
      layers.set(v.id,l); group.addLayer(l);
    });
    $('district').replaceChildren(el('option', '全臺北市')); $('district').firstChild.value = '';
    [...new Set(data.villages.map(v => v.district))].sort().forEach(d => { const o = el('option',d); o.value = d; $('district').append(o); });
    ['district','search','reset'].forEach(id => $(id).disabled = false);
    $('district').onchange = filter; $('search').oninput = filter;$('search').onkeydown=e=>{if(e.key==='Enter'&&visible.length){e.preventDefault();select(visible[0].id);}};
    $('reset').onclick = () => { map.closePopup();pinnedTreeVillage=null;hideHover(); $('district').value = ''; $('search').value = ''; filter(); map.fitBounds(group.getBounds(), { animate: false, padding: [12,12] }); };
    filter(); map.fitBounds(group.getBounds(), { animate: false, padding: [12,12] });
    provenance();
    $('status').textContent = '護照已就緒・456里界與真實快照｜暫定星等為六項有效能力等權平均 ÷ 20；受里面積、取樣與保護名冊影響，非生態品質認證／使用者評價。';
  } catch (error) { $('status').textContent = '資料載入失敗：' + error.message + '。請檢查連線後重試。'; $('retry').hidden = false; }
}
const panelIds = ['finder','passport','legend','method','records'], returnFocus = new Map();
function closePanel(id, focus = true) {
  $(id).hidden = true; $(id+'-toggle')?.setAttribute('aria-expanded','false');
  if(focus) { const target = returnFocus.get(id); if(target?.isConnected && !target.closest('[hidden]')) target.focus({preventScroll:true}); else $(id+'-toggle')?.focus({preventScroll:true}); }
}
function openPanel(id, trigger) {
  panelIds.forEach(other => { if(other !== id) closePanel(other,false); });
  returnFocus.set(id,trigger); $(id).hidden = false; $(id+'-toggle')?.setAttribute('aria-expanded','true');
  hideHover();$(id).querySelector('button')?.focus({preventScroll:true});
  if(id==='records'&&recordLayers)Promise.resolve(recordLayers.ensure()).catch(error=>{$('record-layers-list').textContent='圖層清單載入失敗：'+error.message;});
}
panelIds.forEach(id => {
  const toggle = $(id+'-toggle'); toggle.onclick = () => $(id).hidden ? openPanel(id,toggle) : closePanel(id);
  $(id).querySelector('[data-close]').onclick = () => closePanel(id);
});
$('passport-toggle').onclick=()=>{if(selected)select(selected,false,undefined,$('passport-toggle'));};
for(const node of document.querySelectorAll('.surface')) { L.DomEvent.disableClickPropagation(node); L.DomEvent.disableScrollPropagation(node); }
document.addEventListener('keydown', e => { if(e.key === 'Escape') {if(villageTrees?.isRecordOpen()){e.preventDefault();villageTrees.closeRecord();return;} const id = panelIds.find(id => !$(id).hidden); if(id) { e.preventDefault(); closePanel(id); } else if(popup?.isOpen()) {e.preventDefault();map.closePopup();} else hideHover(); } });
for(const item of [...CAPABILITIES, {label:'多項正值能力並列最高',color:TIE_COLOR}, {label:'有效分數皆0／無有效分數',color:NEUTRAL_COLOR}]) {
  const li = el('li',(item.emoji?item.emoji+' ':'')+(item.key==='activity'?'回報活躍度（DEMO）':item.label)); const swatch = el('span',undefined,'swatch'); swatch.style.background = item.color; li.prepend(swatch); $('legend-items').append(li);
}
$('detail-method').onclick=()=>openPanel('method',$('detail-method'));
$('clear-village-trees').onclick=()=>{map.closePopup(popup);clearSelection();};
const demoBanner=el('div','原型 DEMO｜鳥蟲／回報為模擬；綜合星等含模擬資料，非生態評鑑。','demo-banner');document.querySelector('.toolbar').append(demoBanner);
for(const p of document.querySelectorAll('#legend p,#method p')){if(p.textContent.includes('原生比例、鳥蟲缺資料'))p.textContent='六項均參與著色與綜合星等：三項快照指標、藍圖原生代理、鳥蟲／回報 DEMO（非真實觀測）。';if(p.textContent.includes('沒有原生分類對照'))p.textContent=p.textContent.replace('沒有原生分類對照、鳥蟲可靠觀測時不給數字。','原生比例另用藍圖名稱代理；鳥蟲與回報為 seeded DEMO，不是可靠觀測。');if(p.textContent==='沒有帳號、總分、上傳或儲存紀錄。')p.textContent='沒有帳號、真實回報、上傳或儲存紀錄。綜合星等含兩項模擬，不是使用者評價。';}
setLevel('overview');$('retry').onclick = load; load();
