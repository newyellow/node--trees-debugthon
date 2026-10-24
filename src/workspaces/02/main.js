import {createMetricIcon} from './radar-icons.js';
import {createAdvicePanel} from './advice-panel.js';
import './advice-panel.css';
import {createVisionTour} from './vision-tour.js';
import './vision-tour.css';
import {STAR_BANDS,STAR_UNKNOWN_COLOR,VILLAGE_OPACITY,starColor,rankVillages} from './star-display.js';
import {createCameraMotion} from './camera-motion.js';
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
import './homepage-theme.css';
import { CAPABILITIES, RADAR_CAPABILITIES, dominantCapability, NEUTRAL_COLOR } from './domain.js';
const $ = id => document.getElementById(id), base = import.meta.env.BASE_URL;
let data, regions, map, group, hoverRenderer, selected, recordLayers, villageTrees, visible = [], layers = new Map();
function el(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; }
const fmt = (v, digits = 0) => Number.isFinite(v) ? v.toLocaleString('zh-TW', { maximumFractionDigits: digits }) : 'N/A';
function card(title, score, raw, note) {
  const n = el('article', undefined, 'card'); n.append(el('h3', title));
  const number = el('p', score === null ? 'N/A' : fmt(score) + ' / 100', 'score'); n.append(number);
  if (score !== null) { const meter = el('meter'); meter.min = 0; meter.max = 100; meter.value = score; meter.setAttribute('aria-label', title + '相對分數'); n.append(meter); }
  n.append(el('p', raw, 'raw'), el('p', note, 'caveat')); return n;
}
let level='overview',camera,advice,visionTour,adviceKnowledge,switching=false,suppressPreview=false;
function setLevel(value){level=value;$('stage').dataset.level=value;}
function fitVillage(instant = false) {
  if (!selected) return;
  const toolbar = Math.ceil(document.querySelector('.toolbar').getBoundingClientRect().bottom + 12);
  if(popup)popup.options.maxHeight=Math.max(50,Math.min(440,innerHeight-toolbar-80));
  popup?.update();
  const sidebar = level === 'tree'
    ? Math.min(innerWidth < 761 ? Math.max(145, innerWidth * .43) : 360, innerWidth * .48) : 0;
  const bubble = popup?.getElement()?.getBoundingClientRect().height || 280;
  if ($('species-panel')) $('species-panel').style.top = toolbar + 'px';
  const viewport=map.getContainer().getBoundingClientRect(),width=viewport.width,height=viewport.height;
  const usableWidth=Math.max(40,width-sidebar),left=viewport.left+usableWidth*.1,right=viewport.right-sidebar-usableWidth*.1;
  // Reserve only visible lower controls that overlap the retained horizontal frame.
  const lowerEdges=[...document.querySelectorAll('.status-wrap,#village-trees-controls,.leaflet-control-zoom,.leaflet-control-attribution')].map(n=>n.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0&&r.top>=viewport.top+height/2&&r.right>left&&r.left<right);
  const bottom=lowerEdges.length?Math.max(0,viewport.bottom-Math.min(...lowerEdges.map(r=>r.top))):0;
  camera.fit(layers.get(selected).getBounds(), {
    maxZoom: 18,
    ...villageFitPadding(width, height, {bubble: bubble + 18 + toolbar-viewport.top, bottom, sidebar})
  }, instant);
}
function clearSelection() {
  if (switching || !selected) return;
  advice?.close(false);visionTour?.cancel('selection-close');
  camera.cancel();
  selected = null; pinnedTreeVillage = null; setLevel('overview');
  villageTrees?.closeRecord(false); shownTreeKey = null; hideHover();
  panelIds.forEach(id => closePanel(id, false));
  layers.forEach((layer, id) => styleVillage(id));
  camera.pullback();
  // Returning keyboard focus must not silently start a fresh hover tree request.
  suppressPreview = true;
  const target = popupFocus;
  if (target?.isConnected && !target.closest('[hidden]')) target.focus({preventScroll: true});
  else $('finder-toggle').focus({preventScroll: true});
  suppressPreview = false;
}
let popup, popupFocus, hovered, activeBasemap, basemapKind = 'aerial';
function radar(v,size=170,compact=false) { const chart=createCapabilityRadar({axes:RADAR_CAPABILITIES.map(c=>({...c,value:c.unavailable?null:v.scores[c.key]})),missingAtZero:true,size,compact,pixelStyle:true,label:'六項能力概覽'});chart.querySelector('.radar-units').textContent='0–100 分；指標定義與資料限制請查看細節';return chart; }
function styleVillage(id,hover=false) { layers.get(id)?.setStyle({color:id===selected?'#172f35':'#50616a',weight:id===selected?4:1,fillOpacity:id===selected?VILLAGE_OPACITY.selected:hover?VILLAGE_OPACITY.hover:VILLAGE_OPACITY.base}); }
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
 if(suppressPreview||$('stage').dataset.cameraPhase==='moving'||(level!=='overview'&&!selected) || (!keyboard&&!matchMedia('(hover:hover)').matches))return;
 if(hovered===v.id)return;
 hideHover();const layer=layers.get(v.id),path=layer.getLayers()[0]?.getElement();if(!path)return;
 if(!hoverAnchors.has(v.id)) {
  const geometry=layer.toGeoJSON().features[0].geometry;
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  const projected=polygons.map(p=>p.map(r=>r.map(([lng,lat])=>{const p=map.project([lat,lng],0);return [p.x,p.y];})));
  const point=interiorAnchor(projected);if(!point)return;hoverAnchors.set(v.id,map.unproject(point,0));
 }
 // Selection owns markers/filter; hover styling never overrides selected styling.
 hovered=v.id;styleVillage(v.id,true);if(!selected){previewTimer=setTimeout(()=>{if(!selected&&hovered===v.id)showVillageTrees(v.id,true);},180);}
 const ns='http://www.w3.org/2000/svg', n=document.createElementNS(ns,'g');n.id='hover-preview';n.classList.add('polygon-hover','radar-chart');n.dataset.village=v.id;n.setAttribute('role','img');n.setAttribute('aria-label',v.district+v.name+'能力概覽');
 const text=(value,y,cls)=>{const t=document.createElementNS(ns,'text');t.textContent=value;t.setAttribute('x','0');t.setAttribute('y',y);t.setAttribute('text-anchor','middle');t.setAttribute('class',cls);n.append(t);return t;};
 text(v.district+'・'+v.name,-12,'hover-name');
 const rating=compositeRating(v.scores);n.dataset.rating=rating===null?'N/A':rating.toFixed(1);n.dataset.ratingPolicy=RATING_POLICY.version;
 const foreign=document.createElementNS(ns,'foreignObject');foreign.setAttribute('x','-130');foreign.setAttribute('y','0');foreign.setAttribute('width','260');foreign.setAttribute('height','65');const stars=el('div',undefined,'hover-stars');stars.setAttribute('aria-label','綜合星等 '+(rating===null?'N/A':rating.toFixed(1)+' / 5'));const back=el('span','☆☆☆☆☆','stars-back'),front=el('span','★★★★★','stars-front');front.style.width=(rating===null?0:rating/5*100)+'%';const glyph=el('span',undefined,'stars-glyph');glyph.append(back,front);stars.append(glyph); foreign.append(stars);n.append(foreign);
 if(selected)text('管理樹 '+fmt(v.trees)+' 筆 · 保護名冊 '+fmt(v.protected)+' 筆 · 來源名稱 '+fmt(v.richness)+' 類',80,'hover-tree-summary');
 hoverRenderer._rootGroup.append(n);positionHover();
}
function openDetails(trigger) {openPanel('passport',trigger);$('passport').querySelector('.panel-scroll').scrollTop=0;}
function openAdvice(v,mode,trigger){visionTour?.cancel('new-advice');panelIds.forEach(id=>closePanel(id,false));hideHover(true);advice.open({village:v,mode,trigger});}
function showOverview(v,latlng,trigger) {
 hideHover();panelIds.forEach(id=>closePanel(id,false));popupFocus=trigger||$('finder-toggle');
 const content=el('section',undefined,'village-overview');content.setAttribute('aria-label',v.district+v.name+'概覽');
 const chart=el('div',undefined,'overview-radar-wrap'),helpWrap=el('div',undefined,'metric-help-wrap');
 const help=el('button','?','metric-help');help.type='button';help.setAttribute('aria-label','指標說明');help.setAttribute('aria-controls','method');help.setAttribute('aria-expanded','false');help.setAttribute('aria-describedby','overview-metric-tooltip');
 const tooltip=el('span','指標說明','metric-help-tooltip');tooltip.id='overview-metric-tooltip';tooltip.setAttribute('role','tooltip');helpWrap.append(help,tooltip);
 help.onclick=()=>openPanel('method',help);chart.append(radar(v,220,true),helpWrap);
 content.append(el('div',v.name+' 自然輪廓','overview-radar-title'),chart);
 const rating=compositeRating(v.scores),ratingText=rating===null?'N/A':rating.toFixed(1)+' / 5';
 const stars=el('div',undefined,'rating-note summary-stars');stars.setAttribute('role','img');stars.setAttribute('aria-label','綜合星等 '+ratingText);
 const glyph=el('span',undefined,'stars-glyph'),back=el('span','☆☆☆☆☆','stars-back'),front=el('span','★★★★★','stars-front');glyph.setAttribute('aria-hidden','true');front.style.width=(rating===null?0:rating/5*100)+'%';glyph.append(back,front);stars.append(glyph,el('span',ratingText,'stars-number'));content.append(stars);
 const actions=el('div',undefined,'overview-actions');for(const [text,mode] of [['查看細節',null],['種樹建議','planting'],['居家植栽','home']]) {const b=el('button',text);b.type='button';b.onclick=()=>mode?openAdvice(v,mode,b):openDetails(b);actions.append(b);}content.append(actions);
 L.DomEvent.disableClickPropagation(content);L.DomEvent.disableScrollPropagation(content);
 switching=true;if(popup)map.closePopup(popup);switching=false;
 popup=L.popup({autoClose:false,closeOnClick:false,autoPan:false,className:'village-popup',maxWidth:280,minWidth:Math.min(230,innerWidth-72),maxHeight:Math.max(130,Math.min(510,innerHeight-205)),autoPanPaddingTopLeft:[16,135],autoPanPaddingBottomRight:[16,35],closeOnEscapeKey:false}).setLatLng([layers.get(v.id).getBounds().getNorth(),layers.get(v.id).getBounds().getCenter().lng]).setContent(content).openOn(map);
 popup.on('remove',()=>{if(!switching)clearSelection();});
 fitVillage();
}
function switchBasemap(kind,retry=false) {
 const sources={street:{url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',note:'OpenStreetMap 街道圖',credit:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'},aerial:{url:'https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}',note:'國土測繪中心最新拼接航照；非即時影像，未提供精確攝影日期。',credit:'© <a href="https://www.nlsc.gov.tw/">內政部國土測繪中心</a>'},terrain:{url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',note:'OpenTopoMap 地形圖｜OSM / SRTM；非即時地質或植群調查。',credit:'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style © <a href="https://opentopomap.org/about">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'}};
 if(!sources[kind])kind='street';const source=sources[kind];if(activeBasemap)map.removeLayer(activeBasemap);basemapKind=kind;$('basemap').value=kind;$('tile-retry').hidden=true;$('imagery-note').textContent=source.note;
 const layer=L.tileLayer(source.url,{maxZoom:21,maxNativeZoom:kind==='terrain'?17:19,attribution:source.credit});activeBasemap=layer;let failed=false;
 layer.on('tileerror',()=>{if(failed||activeBasemap!==layer)return;failed=true;if(kind!=='street'){switchBasemap('street');$('tile-status').textContent=(kind==='terrain'?'地形':'航照')+'載入失敗，已回到街道圖。';$('tile-retry').textContent=kind==='terrain'?'重試地形':'重試航照';}else{$('tile-status').textContent='街道底圖載入失敗；里界仍可操作。';$('tile-retry').textContent='重試底圖';}$('tile-retry').hidden=false;});$('tile-status').textContent='';layer.addTo(map);
}
function select(id, fit = true, latlng, trigger = document.activeElement) {
  const v = data.villages.find(r => r.id === id); if (!v) return;advice?.close(false);visionTour?.cancel('new-village');camera.cancel();switching=true;villageTrees?.closeRecord(false);switching=false;setLevel('village');selected = id;pinnedTreeVillage=id;showVillageTrees(id,false);
  layers.forEach((l,key)=>styleVillage(key));
  camera.cancel(); map.invalidateSize({pan:false,animate:false});
  layers.get(id)?.bringToFront();
  showOverview(v,latlng,trigger);
  const strongest = dominantCapability(v.scores); $('strongest').textContent = strongest.text; $('strongest').style.borderColor = strongest.color;
  $('passport').querySelector('.panel-scroll').scrollTop = 0;
  $('village-title').textContent = v.district + '・' + v.name;
  $('village-meta').textContent = '里全面積 ' + fmt(v.areaKm2, 3) + ' km²｜固定參考母體：全臺北456里｜快照 ' + data.treeSnapshot.slice(0,10);
  $('village-summary').textContent='管理樹 '+fmt(v.trees)+' 筆 · 保護名冊 '+fmt(v.protected)+' 筆 · 來源名稱 '+fmt(v.richness)+' 類。';
  const rating=compositeRating(v.scores);$('village-rating-method').textContent='綜合星等 '+(rating===null?'N/A':rating.toFixed(1)+' / 5')+'：六項有效能力等權平均 ÷ 20。前三項為快照相對分數，原生比例為藍圖代理值，鳥蟲與回報活躍度為 DEMO 模擬。密度是代理指標；非使用者評論或生態品質評鑑。各項分母與限制見下方。';
  $('cards').replaceChildren(
    card('01 綠覆率', v.scores.treeDensity, fmt(v.treeDensity,1) + ' 筆/km²｜' + fmt(v.trees) + ' 筆 ÷ ' + fmt(v.areaKm2,3) + ' km²', '此處以管理樹木密度作為代理分數，並非實測綠覆百分比、樹冠面積或全里樹木普查。'),
    card('02 受保護樹木量', v.scores.protectedDensity, fmt(v.protectedDensity,1) + ' 筆/km²｜名冊 ' + fmt(v.protected) + ' 筆 ÷ ' + fmt(v.areaKm2,3) + ' km²', '此分數依名冊紀錄密度計算，上方另列實際紀錄量。文化局名冊空間歸屬；非候選大樹。資料期間較舊，法律現況須查證。'),
    card('03 物種多樣性', v.scores.richness, fmt(v.richness) + ' 類｜有名稱 ' + fmt(v.knownNames) + '/' + fmt(v.trees) + ' 筆', 'Shannon ' + fmt(v.shannon,3) + '；最大類別占比 ' + (v.dominance === null ? 'N/A' : fmt(v.dominance*100,1) + '%') + '。未知 ' + v.missingNames + '、枯木 ' + v.deadStatus + ' 筆。非全植物物種數；受取樣量影響。'),
    card('04 原生種比例', v.scores.nativeShare,fmt(v.socialMetrics.native.matched)+' / '+fmt(v.trees)+' 筆（全部管理樹分母）','只比對藍圖19個名稱；未列者為本原型假設非原生，不是植物學事實。未知 '+v.socialMetrics.native.unknown+'、枯木 '+v.socialMetrics.native.dead+' 筆仍在分母；API 原生旗標不計分。'),
    card('05 鳥類昆蟲',v.scores.birdInsect,'介面展示分數','非真實觀測、圖鑑數量或生態品質；固定種子僅供介面展示。※ 回報互動系統尚未實裝，目前為模擬資料'),
    card('06 民眾貢獻度',v.scores.activity,fmt(v.socialMetrics.activity.reportedCount)+' / '+fmt(v.socialMetrics.activity.dueCount)+' 筆 · 7日模擬回報／應回報樹數','7日模擬回報數 ÷ 應回報樹數 ×100；2026-10-18–24。沒有真實市民回報、上傳或使用者評論。※ 回報互動系統尚未實裝，目前為模擬資料'),
  );
  [...$('cards').children].forEach((n,i) => { const c = CAPABILITIES[i]; if(c) { const icon=createMetricIcon(c.key); icon.classList.add('capability-icon'); n.querySelector('h3').prepend(icon,document.createTextNode(' ')); } n.style.setProperty('--capability', c?.color || NEUTRAL_COLOR); if(c) n.dataset.capability = c.key; });
  document.querySelectorAll('#villages button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
}
function renderRankings(){
 const rows=rankVillages(data.villages);$('ranking-count').textContent='全臺北 '+rows.length+' 里｜依目前綜合星等排序；同分並列，下一名依序跳號。';
 $('village-rankings').replaceChildren(...rows.map(({village:v,rating,rank})=>{
  const li=el('li'),button=el('button');button.type='button';button.dataset.village=v.id;button.dataset.rating=rating===null?'N/A':String(rating);button.dataset.rank=rank===null?'N/A':String(rank);
  const dot=el('span',undefined,'ranking-swatch');dot.style.background=starColor(rating);dot.setAttribute('aria-hidden','true');button.append(el('span',rank===null?'—':String(rank),'ranking-place'),dot,el('span',v.district+'・'+v.name,'ranking-name'),el('span',rating===null?'N/A':rating.toFixed(1)+' ★','ranking-stars'));button.setAttribute('aria-label',(rank===null?'未排名':'第 '+rank+' 名')+'，'+v.district+v.name+'，'+(rating===null?'無有效星等':rating.toFixed(1)+' 星'));
  button.onclick=()=>{$('district').value='';$('search').value='';filter();select(v.id,true,undefined,button);};li.append(button);return li;
 }));
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
  if (level==='overview' && visible.length && district) camera.fit(group.getBounds(), { padding: [15,15] });
}
function provenance() {
  const p = $('provenance'); p.replaceChildren();p.append(el('p','六項綜合星等：有效值等權平均 ÷20。各項指標的分母、資料來源與限制請見里的「查看細節」。'));
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
    const [d,r,m,k] = await Promise.all([fetchJSON('village-game.json'), fetchJSON('regions.json'),fetchJSON('social-metrics.json'),fetchJSON('plant-advice-knowledge.json').catch(()=>({json:null}))]);adviceKnowledge=k.json; const gameHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',d.bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(gameHash!==GAME_SHA256)throw Error('管理樹統計檔案 SHA 不符');data=applySocialMetrics(d.json,m.json);regions=r.json;
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', r.bytes))].map(n => n.toString(16).padStart(2,'0')).join('');
    if (data.schemaVersion !== 1 || data.villages.length !== 456 || regions.features.length !== 456 || regions.treeSnapshot !== data.treeSnapshot || digest !== data.inputHashes['regions.json']) throw new Error('快照或里界版本不一致');
    const ids = new Set(regions.features.map(f => f.properties.id)); if (new Set(data.villages.map(v => v.id)).size !== 456 || data.villages.some(v => !ids.has(v.id))) throw new Error('里代碼不一致');
    if (!map) {
      map = L.map('map', { scrollWheelZoom: true, zoomControl: false, zoomAnimation: true, fadeAnimation: true, markerZoomAnimation:true, zoomSnap:0, zoomDelta:.5, wheelPxPerZoomLevel:110, wheelDebounceTime:35 }).setView([25.06,121.55],11);
      camera=createCameraMotion(map,{host:$('stage')});
      visionTour=createVisionTour({map,camera,leaflet:L,host:$('stage'),getRegions:()=>regions,getBasemap:()=>basemapKind,setBasemap:kind=>switchBasemap(kind)});
      advice=createAdvicePanel({base,container:$('stage'),onVision:()=>{if(!adviceKnowledge)throw Error('願景資料暫不可用');const started=visionTour.start(adviceKnowledge);return started?{finished:visionTour.whenFinished(),cancel:()=>visionTour.cancel('advice-cancel')}:null;},onClose:()=>visionTour.cancel('advice-close')});
      switchBasemap('aerial');
      $('basemap').onchange=()=>{visionTour.cancel('manual-basemap',{restoreBasemap:false});switchBasemap($('basemap').value);};
      $('tile-retry').onclick=()=>switchBasemap($('tile-retry').textContent.includes('地形')?'terrain':$('tile-retry').textContent.includes('航照')?'aerial':basemapKind,true);
      L.control.zoom({ position: 'bottomleft' }).addTo(map);
      group = L.featureGroup().addTo(map);
      const hoverPane=map.createPane('village-hover');hoverPane.style.zIndex='490';hoverPane.style.pointerEvents='none';
      hoverRenderer=L.svg({pane:'village-hover',padding:0.5}).addTo(map);
      hoverRenderer._container.style.pointerEvents='none';
      recordLayers=installRecordLayers({map,isCameraMoving:()=>camera.isMoving(),host:$('record-layers-list'),base,onPointerHit:()=>hideHover(true),onFeatureOpen:()=>{hideHover();panelIds.forEach(id=>closePanel(id,false));}});
      villageTrees=createVillageTrees({map,base,isCameraMoving:()=>camera.isMoving(),statusHost:$('village-tree-status'),expectedSnapshot:data.treeSnapshot,expectedSourceHashes:data.inputHashes,villageInfo:id=>data.villages.find(v=>v.id===id),onPointerHit:()=>hideHover(true),onFeatureClose:()=>{if(!switching&&selected){setLevel('village');}},onFeatureOpen:({villageId,preview}={})=>{if(preview){select(villageId);return;}if(villageId&&selected!==villageId)select(villageId);pinnedTreeVillage=villageId;shownTreeKey=villageId+':false';hideHover(true);panelIds.forEach(id=>closePanel(id,false));setLevel('tree');$('species-panel').style.top=Math.ceil(document.querySelector('.toolbar').getBoundingClientRect().bottom+12)+'px';},onState:state=>{recordLayers.setExcludedTrees(state.phase==='ready'?state.records:[]);}});
      recordLayers.setPriorityHitTest(event=>villageTrees.containsEvent?.(event)||false);
      // Overlay lifecycle and resize never imply a new village-selection camera intent.
      map.on('resize',()=>{visionTour?.cancel('resize');});map.on('zoom viewreset moveend',positionHover);map.on('dragstart zoomstart',()=>hideHover());
    }
    hideHover();hoverAnchors.clear();group.clearLayers(); layers = new Map();
    const villagesById = new Map(data.villages.map(v => [v.id,v]));
    regions.features.forEach(f => {
      const v = villagesById.get(f.properties.id), rating=compositeRating(v.scores);
      const l = L.geoJSON(f, { style: { color: '#50616a', weight: 1, fillColor: starColor(rating), fillOpacity: VILLAGE_OPACITY.base } });
      l.on('mouseover mousemove',e=>{if(villageTrees?.containsEvent(e.originalEvent)||recordLayers?.containsEvent(e.originalEvent))return;showHover(v);});
      l.on('mouseout',()=>hideHover());
      l.on('click',e=>select(v.id,true,e.latlng,e.originalEvent?.target));
      l.eachLayer(path => {
        path.on('add', () => { const node = path.getElement(); node.dataset.village = v.id; node.setAttribute('tabindex','0'); node.setAttribute('role','button'); node.setAttribute('aria-label',v.district + v.name + '｜綜合星等'+(rating===null?'N/A':rating.toFixed(1)+' / 5'));
          node.onfocus=()=>{if(node.matches(':focus-visible'))showHover(v,true);};node.onblur=()=>hideHover();
          node.onkeydown = e => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); select(v.id,true,undefined,node); popup?.getElement()?.querySelector('button')?.focus({preventScroll:true}); } };
        });
      });
      layers.set(v.id,l); group.addLayer(l);
    });
    $('district').replaceChildren(el('option', '全臺北市')); $('district').firstChild.value = '';
    [...new Set(data.villages.map(v => v.district))].sort().forEach(d => { const o = el('option',d); o.value = d; $('district').append(o); });
    ['district','search'].forEach(id => $(id).disabled = false);
    $('district').onchange = filter; $('search').oninput = filter;$('search').onkeydown=e=>{if(e.key==='Enter'&&visible.length){e.preventDefault();select(visible[0].id);}};
    filter(); map.fitBounds(group.getBounds(), { animate: false, padding: [12,12] });
    renderRankings();provenance();
    $('status').textContent = '護照已就緒・456里界與真實快照｜暫定星等為六項有效能力等權平均 ÷ 20；受里面積、取樣與保護名冊影響，非生態品質認證／使用者評價。';
  } catch (error) { $('status').textContent = '資料載入失敗：' + error.message + '。請檢查連線後重試。'; $('retry').hidden = false; }
}
const panelIds = ['finder','ranking','passport','method','records'], returnFocus = new Map();
let indicatorScroll=0,indicatorFromDetails=false;
function closePanel(id, focus = true) {
  $(id).hidden = true; $(id+'-toggle')?.setAttribute('aria-expanded','false');returnFocus.get(id)?.setAttribute('aria-expanded','false');
  if(id==='method'&&focus&&selected&&indicatorFromDetails){$('passport').hidden=false;$('passport').querySelector('.panel-scroll').scrollTop=indicatorScroll;$('detail-method').focus({preventScroll:true});return;}
  if(focus) { const target = returnFocus.get(id); if(target?.isConnected && !target.closest('[hidden]')) target.focus({preventScroll:true}); else $(id+'-toggle')?.focus({preventScroll:true}); }
}
function openPanel(id, trigger) {
  advice?.close(false);visionTour?.cancel('open-panel');
  if(id==='method'){indicatorFromDetails=trigger===$('detail-method');indicatorScroll=$('passport').querySelector('.panel-scroll').scrollTop;$('indicator-back').textContent=indicatorFromDetails?'返回里細節':'返回自然輪廓';$('method').querySelector('.panel-scroll').scrollTop=0;}
  panelIds.forEach(other => { if(other !== id) closePanel(other,false); });
  returnFocus.set(id,trigger);trigger?.setAttribute('aria-expanded','true'); $(id).hidden = false; $(id+'-toggle')?.setAttribute('aria-expanded','true');
  hideHover();$(id).querySelector('button')?.focus({preventScroll:true});
  if(id==='records'&&recordLayers)Promise.resolve(recordLayers.ensure()).catch(error=>{$('record-layers-list').textContent='圖層清單載入失敗：'+error.message;});
}
panelIds.forEach(id => {
  const toggle = $(id+'-toggle'); if(toggle)toggle.onclick = () => $(id).hidden ? openPanel(id,toggle) : closePanel(id);
  $(id).querySelector('[data-close]').onclick = () => closePanel(id);
});
for(const node of document.querySelectorAll('.surface')) { L.DomEvent.disableClickPropagation(node); L.DomEvent.disableScrollPropagation(node); }
document.addEventListener('keydown', e => { if(e.key === 'Escape') {if(advice?.isOpen()){e.preventDefault();advice.close();return;}if(villageTrees?.isRecordOpen()){e.preventDefault();villageTrees.closeRecord();return;} const id = panelIds.find(id => !$(id).hidden); if(id) { e.preventDefault(); closePanel(id); } else if(popup?.isOpen()) {e.preventDefault();map.closePopup();} else hideHover(); } });
for(const item of CAPABILITIES) {
 const descriptions={
 treeDensity:'以每平方公里管理樹木紀錄量計算相對分數，作為綠意的代理指標；不是實測綠覆百分比或樹冠面積。',
 protectedDensity:'依官方受保護樹木名冊紀錄量除以里面積計分；詳細資料另列實際筆數。名冊較舊，法律現況須另查證。',
 richness:'以來源資料中的樹木名稱類別數計分，排除未知與枯木；不是完整物種調查，取樣量會影響結果。',
 nativeShare:'藍圖19個名稱相符的紀錄占全部管理樹木的比例；未列名稱暫作非原生，僅為原型代理，並非分類學鑑定。',
 birdInsect:'展示鳥類與昆蟲的指標位置，目前為固定種子產生的展示分數，非實際觀測或物種數。※ 回報互動系統尚未實裝，目前為模擬資料',
 activity:'近7日已回報筆數／應回報樹數×100；目前沒有真實市民回報，分母為零時記0。※ 回報互動系統尚未實裝，目前為模擬資料'
 };
 const li=el('li'),heading=el('h4',item.label);heading.prepend(createMetricIcon(item.key),document.createTextNode(' '));li.append(heading,el('p',descriptions[item.key]));$('legend-items').append(li);
}
for(const item of [...STAR_BANDS,{label:'N/A 無有效星等',color:STAR_UNKNOWN_COLOR}]){const li=el('li',item.label),swatch=el('span',undefined,'swatch');swatch.style.background=item.color;li.prepend(swatch);$('star-color-items').append(li);}
$('detail-method').onclick=()=>openPanel('method',$('detail-method'));
$('indicator-back').onclick=()=>closePanel('method');
$('clear-village-trees').onclick=()=>{map.closePopup(popup);clearSelection();};
for(const p of document.querySelectorAll('#legend p,#method p')){if(p.textContent.includes('原生比例、鳥蟲缺資料'))p.textContent='六項均參與著色與綜合星等；指標定義、資料來源及限制請查看細節。';if(p.textContent.includes('沒有原生分類對照'))p.textContent=p.textContent.replace('沒有原生分類對照、鳥蟲可靠觀測時不給數字。','原生種比例及鳥類昆蟲的定義與資料限制請查看細節。');if(p.textContent==='沒有帳號、總分、上傳或儲存紀錄。')p.textContent='沒有公民回報或照片上傳功能。AI 對話可能由服務端保留，請勿輸入個資。綜合星等不是使用者評價；資料說明請查看細節。';}
setLevel('overview');$('retry').onclick = load; load();
