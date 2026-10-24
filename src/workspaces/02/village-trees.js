import {createStoryPanel} from './story-panel.js';
import L from 'leaflet';
import {treeSpecies,treeSpeciesColor,updateSpeciesLegend} from './tree-species.js';
import './village-trees.css';

const TREE_LAYERS = ['street-trees', 'park-trees'];
const fail = message => { throw new Error(message); };
const hashPattern = /^[a-f0-9]{64}$/i;
const integer = n => Number.isSafeInteger(n) && n >= 0;
export async function sha256(bytes) {
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function validateVillageManifest(value, expectedSnapshot, expectedSourceHashes = {}) {
  if (value?.schemaVersion !== 1 || typeof value.treeSnapshot !== 'string' || !value.treeSnapshot || (expectedSnapshot && value.treeSnapshot !== expectedSnapshot)) fail('管理樹快照版本不一致');
  if (!value.sourceHashes || !TREE_LAYERS.every(id => hashPattern.test(value.sourceHashes[id + '.geojson'] ?? value.sourceHashes[id] ?? ''))) fail('來源 SHA-256 格式錯誤');
  for (const [key, hash] of Object.entries(expectedSourceHashes || {})) {
    // Caller may supply the complete village-game inputHashes, including boundary metadata.
    const actual = value.sourceHashes[key] ?? (key.endsWith('.geojson') ? value.sourceHashes[key.slice(0,-8)] : value.sourceHashes[key + '.geojson']);
    if (actual !== hash) fail('來源快照雜湊不一致：' + key);
  }
  if (!value.villages || Array.isArray(value.villages) || typeof value.villages !== 'object') fail('里目錄格式錯誤');
  for (const [id, v] of Object.entries(value.villages)) {
    if (v?.id !== id || typeof v.name !== 'string' || typeof v.district !== 'string' || !integer(v.count) || !hashPattern.test(v.sha256 || '') || typeof v.file !== 'string' || !/^[a-zA-Z0-9_./-]+\.json$/.test(v.file) || v.file.split('/').some(p => p === '..' || p === '.') || v.file.startsWith('/') || !v.byLayer || !TREE_LAYERS.every(k => integer(v.byLayer[k])) || TREE_LAYERS.reduce((n,k) => n + v.byLayer[k],0) !== v.count) fail('里分片目錄格式錯誤：' + id);
  }
  return value;
}
export function validateVillageShard(value, entry, snapshot) {
  if (value?.schemaVersion !== 1 || value.villageId !== entry.id || value.treeSnapshot !== snapshot || !Array.isArray(value.records) || value.records.length !== entry.count) fail('里分片版本、代碼或筆數不一致');
  const identities = new Set(), indices = new Set(), counts = Object.fromEntries(TREE_LAYERS.map(k => [k,0]));
  for (const r of value.records) {
    const f = r?.feature, p = f?.geometry?.coordinates;
    if (!TREE_LAYERS.includes(r?.layerId) || !integer(r.sourceIndex) || typeof r.treeId !== 'string' || String(r.treeId).trim() === '' || f?.type !== 'Feature' || !f.properties || Array.isArray(f.properties) || typeof f.properties.TreeID !== 'string' || f.properties.TreeID !== r.treeId || f.geometry?.type !== 'Point' || !Array.isArray(p) || p.length < 2 || !p.every(Number.isFinite) || p[0] < -180 || p[0] > 180 || p[1] < -90 || p[1] > 90) fail('樹木身分或點座標錯誤');
    const identity = JSON.stringify([r.layerId,String(r.treeId)]), index = r.layerId + ':' + r.sourceIndex;
    if (identities.has(identity) || indices.has(index)) fail('樹木身分或來源索引重複');
    identities.add(identity); indices.add(index); counts[r.layerId]++;
  }
  if (TREE_LAYERS.some(k => counts[k] !== entry.byLayer[k])) fail('分來源筆數不一致');
  return value.records; // Never clone, decorate or mutate original source features.
}
export function samePointRecords(records, record) {
  const [x,y] = record.feature.geometry.coordinates;
  return records.filter(r => r.feature.geometry.coordinates[0] === x && r.feature.geometry.coordinates[1] === y);
}
export function createVillageTreeLoader({base = '/', expectedSnapshot, expectedSourceHashes, fetcher = (...args) => fetch(...args), changed = () => {}, cacheLimit = 8} = {}) {
  const root = base.replace(/\/$/, '') + '/data/village-trees/';
  const cache = new Map(), pending = new Map();
  let manifest, manifestPending, generation = 0, dead = false;
  async function bytes(file) {
    const response = await fetcher(root + file, {signal: AbortSignal.timeout(30000)});
    if (!response.ok) fail('HTTP ' + response.status);
    return response.arrayBuffer();
  }
  const parse = b => JSON.parse(new TextDecoder().decode(b));
  async function metadata() {
    if (manifest) return manifest;
    if (!manifestPending) manifestPending = bytes('manifest.json').then(b => validateVillageManifest(parse(b), expectedSnapshot, expectedSourceHashes)).then(m => (manifest = m)).finally(() => { manifestPending = null; });
    return manifestPending;
  }
  function touch(id, data) {
    cache.delete(id); cache.set(id,data);
    while (cache.size > Math.max(1,Math.min(8,cacheLimit))) cache.delete(cache.keys().next().value);
    return data;
  }
  async function load(id) {
    if (cache.has(id)) return touch(id,cache.get(id));
    if (pending.has(id)) return pending.get(id);
    const task = (async () => {
      const m = await metadata(), entry = m.villages[id];
      if (!entry) fail('找不到里代碼：' + id);
      const b = await bytes(entry.file);
      if (await sha256(b) !== entry.sha256.toLowerCase()) fail('里分片 SHA-256 不一致');
      const records = validateVillageShard(parse(b), entry, m.treeSnapshot);
      const data = {entry, records, treeSnapshot:m.treeSnapshot, sourceHashes:m.sourceHashes};
      if (!dead) touch(id,data);
      return data;
    })().finally(() => pending.delete(id));
    pending.set(id,task); return task;
  }
  function notify(state) { if (!dead) changed(state); }
  return {
    cache, load,
    async show(villageId, {preview = false} = {}) {
      if (dead) return null;
      const token = ++generation;
      notify({phase:'loading',villageId,preview,records:[],count:0,generation:token});
      try {
        const data = await load(villageId);
        if (dead || token !== generation) return null;
        const state = {phase:'ready',villageId,preview,...data,count:data.records.length,generation:token};
        notify(state); return state;
      } catch (error) {
        if (!dead && token === generation) notify({phase:'error',villageId,preview,records:[],count:0,error,generation:token});
        return null;
      }
    },
    clear() { generation++; notify({phase:'clear',villageId:null,records:[],count:0,generation}); },
    destroy() { generation++; dead = true; cache.clear(); }
  };
}

export function createVillageTrees({map, base = '/', statusHost, onFeatureOpen = () => {}, onFeatureClose = () => {}, villageInfo = () => ({}), onState = () => {}, expectedSnapshot, expectedSourceHashes}) {
  if (!map || !statusHost) throw new Error('Village trees require map and statusHost');
  const paneName = 'village-trees-' + L.Util.stamp(statusHost), pane = map.createPane(paneName);
  pane.style.zIndex = '470'; pane.style.pointerEvents = 'none'; pane.classList.add('village-trees-pane');
  const renderer = L.canvas({pane:paneName,padding:0.25}).addTo(map), group = L.layerGroup().addTo(map);
  const canvas = renderer._container, container = map.getContainer();
  canvas.dataset.villageTrees = ''; canvas.dataset.renderedCount = '0'; canvas.tabIndex = 0;
  canvas.style.pointerEvents = 'none'; canvas.setAttribute('role','group');
  const title = document.createElement('strong'), message = document.createElement('span'), caveat = document.createElement('small'), retry = document.createElement('button');
  retry.type = 'button'; retry.textContent = '重試管理樹'; retry.hidden = true;
  caveat.textContent = '管理樹來源紀錄，非全里所有現地樹木；非即時普查。';
  const legend=document.createElement('section');legend.className='tree-species-legend';const rawDetails=document.createElement('details'),rawSummary=document.createElement('summary');rawDetails.className='raw-tree-details';rawSummary.append(title);rawDetails.append(rawSummary,message,caveat,retry,legend);statusHost.append(rawDetails);
  let lastReady;const rawToggle=document.createElement('button');rawToggle.type='button';rawToggle.textContent='里內樹圖例';rawToggle.setAttribute('aria-expanded','false');rawToggle.onclick=()=>{if(state.phase==='clear'&&lastReady){title.textContent=lastReady.entry.district+'・'+lastReady.entry.name+'（上次檢視）';message.textContent='圖例為上次檢視的 '+lastReady.count+' 筆來源紀錄；不是目前全市圖例。';updateSpeciesLegend(legend,lastReady.records.map(r=>r.feature));}statusHost.parentElement.hidden=false;rawDetails.open=!rawDetails.open;rawToggle.setAttribute('aria-expanded',String(rawDetails.open));statusHost.parentElement.classList.toggle('raw-status-expanded',rawDetails.open);};document.querySelector('.toolbar').append(rawToggle); statusHost.setAttribute('aria-live','polite');
  const stories=createStoryPanel({base});
  const sidebar=document.createElement('aside');sidebar.id='species-panel';sidebar.className='surface species-panel';sidebar.hidden=true;sidebar.setAttribute('aria-label','樹種與原始紀錄');container.parentElement.append(sidebar);
  let tooltip,hoverSpecies=null;
  function highlight(species){if(species===hoverSpecies)return;hoverSpecies=species;canvas.dataset.highlightSpecies=species||'';let count=0;for(const {marker,record} of markers){const match=!species||treeSpecies(record.feature)===species;if(species&&match)count++;marker.setStyle({fillOpacity:match?.95:.15,opacity:match?1:.18,weight:species&&match?2:1});}canvas.dataset.highlightCount=String(count);}
  function clearHover(){highlight(null);if(tooltip){map.removeLayer(tooltip);tooltip=null;}}
  function closeRecord(focus=true){stories.cancel();sidebar.hidden=true;sidebar.replaceChildren();clearHover();onFeatureClose();if(focus)canvas.focus({preventScroll:true});clearHover();}
  let dead = false, token = 0, state = {records:[]}, markers = [], selected = 0, popup;
  const label = r => String(r.feature.properties.TreeType || r.feature.properties.Name || r.feature.properties._name || '管理樹') + ' · TreeID ' + r.treeId;
  function keyboardLabel() {
    canvas.setAttribute('aria-label', state.records.length ? '里內管理樹 '+ (selected+1) + ' / ' + state.records.length + '：' + label(state.records[selected]) + '；方向鍵逐筆瀏覽，Enter 開啟來源欄位' : '里內管理樹：目前無紀錄');
    if (state.records[selected]) {canvas.dataset.treeId = String(state.records[selected].treeId); canvas.dataset.layerId = state.records[selected].layerId;}
    else {delete canvas.dataset.treeId; delete canvas.dataset.layerId;}
  }
  function openRecord(record) {
    if (!record || dead) return;
    if(state.preview){onFeatureOpen({villageId:state.villageId,preview:true});return;}
    onFeatureOpen({villageId:state.villageId,record});clearHover();
    const box = document.createElement('section'); box.className = 'village-tree-popup';
    box.dataset.villageId = state.villageId; box.dataset.treeId = String(record.treeId); box.dataset.layerId = record.layerId;
    const add = (tag,text) => {const e = document.createElement(tag); e.textContent = text; box.append(e); return e;};
    add('h3',label(record));
    const overlaps = samePointRecords(state.records,record);
    if (overlaps.length > 1) {
      add('p','同座標 ' + overlaps.length + ' 筆；選取任一原始紀錄：');
      const list = document.createElement('div'); list.className = 'village-tree-overlap-list';
      for (const item of overlaps) {const b = document.createElement('button'); b.type = 'button'; b.textContent = item.layerId + ' · ' + label(item); b.dataset.treeId = String(item.treeId); b.dataset.layerId = item.layerId; b.setAttribute('aria-pressed',String(item === record)); b.onclick = () => openRecord(item); list.append(b);} box.append(list);
    }
    add('p','來源：公園路燈工程管理處 · '+record.layerId+'；擷取 '+state.treeSnapshot.slice(0,10)+'（非調查日期）');
    const list = document.createElement('dl');
    for (const [key,value] of Object.entries(record.feature.properties)) {const dt = document.createElement('dt'),dd = document.createElement('dd');dt.textContent = key;dd.textContent = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');list.append(dt,dd);} box.append(list);
    add('p','WGS84 原始座標（經度、緯度）：' + JSON.stringify(record.feature.geometry.coordinates));
    if (record.feature.id !== undefined) add('p','GeoJSON Feature ID：' + String(record.feature.id));
    const provenance=document.createElement('details'),summary=document.createElement('summary'),sourceInfo=document.createElement('p');summary.textContent='來源版本與雜湊';sourceInfo.textContent='快照 '+state.treeSnapshot+'；來源索引（0起算）'+record.sourceIndex+'；SHA-256：'+(state.sourceHashes[record.layerId+'.geojson']??state.sourceHashes[record.layerId]);provenance.append(summary,sourceInfo);box.append(provenance);
    L.DomEvent.disableClickPropagation(box); L.DomEvent.disableScrollPropagation(box);
    const close=document.createElement('button');close.type='button';close.textContent='關閉樹種';close.className='species-close';close.onclick=()=>closeRecord();
    const storyHost=document.createElement('section');storyHost.className='species-stories';
    const heading=box.querySelector('h3'),source=[...box.querySelectorAll('p')].find(n=>n.textContent.startsWith('來源：'));
    const originals=document.createElement('details'),originalSummary=document.createElement('summary');originals.className='original-record-details';originalSummary.textContent='完整原始紀錄／同座標紀錄';originals.append(originalSummary);
    for(const child of [...box.children])if(child!==heading&&child!==source)originals.append(child);
    box.replaceChildren(heading,source,storyHost,originals);
    sidebar.replaceChildren(close,box);sidebar.hidden=false;close.focus({preventScroll:true});sidebar.scrollTop=0;
    const info=villageInfo(state.villageId);void stories.show(storyHost,{species:treeSpecies(record.feature),village:info.name||state.entry.name,district:info.district||state.entry.district});

  }
  function resetRender() {clearHover();if(!sidebar.hidden)closeRecord(false);token++; group.clearLayers(); markers = []; selected = 0; canvas.dataset.renderedCount = '0'; if (popup) {map.closePopup(popup); popup = null;} }
  async function render(next) {
    resetRender(); state = next; const current = token;
    statusHost.dataset.phase = next.phase; statusHost.dataset.villageId = next.villageId || ''; statusHost.dataset.count = String(next.count);
    canvas.dataset.villageId = next.villageId || ''; canvas.dataset.phase = next.phase; retry.hidden = next.phase !== 'error';if(next.phase==='error')rawDetails.open=true;else if(next.phase==='loading'||next.phase==='clear'){rawDetails.open=false;statusHost.parentElement.classList.remove('raw-status-expanded');rawToggle.setAttribute('aria-expanded','false');}
    title.textContent = next.entry ? next.entry.district + '・' + next.entry.name : next.villageId || '里內管理樹';
    message.textContent = next.phase === 'loading' ? '管理樹載入中…' : next.phase === 'error' ? '管理樹載入失敗：' + next.error.message : next.phase === 'clear' ? '指向或選取里以顯示每筆管理樹' : '共 ' + next.count.toLocaleString('zh-TW') + ' 筆（行道樹 ' + next.entry.byLayer['street-trees'] + '／公園樹 ' + next.entry.byLayer['park-trees'] + '）';
    keyboardLabel(); updateSpeciesLegend(legend,(next.records||[]).map(r=>r.feature)); onState(next);
    if (next.phase !== 'ready') return;lastReady=next;
    statusHost.dataset.phase = 'rendering';
    for (let i = 0; i < next.records.length; i++) {
      if (dead || current !== token) return;
      const r = next.records[i], [lng,lat] = r.feature.geometry.coordinates;
      const marker = L.circleMarker([lat,lng],{renderer,pane:paneName,radius:4,weight:1,color:'#ffffff',fillColor:treeSpeciesColor(r.feature),fillOpacity:0.95,interactive:false,bubblingMouseEvents:false}).addTo(group);
      markers.push({marker,record:r}); canvas.dataset.renderedCount = String(markers.length);
      if (i % 400 === 399) await new Promise(resolve => setTimeout(resolve,0));
    }
    if (!dead && current === token) {statusHost.dataset.phase = 'ready'; canvas.dataset.phase = 'ready'; canvas.dataset.renderedCount = String(next.records.length);}
  }
  const loader = createVillageTreeLoader({base,expectedSnapshot,expectedSourceHashes,changed:next => {void render(next);}});
  retry.onclick = () => loader.show(state.villageId,{preview:state.preview});
  function hitTestLayerPoint(point) {
    return markers.some(({marker}) => marker._point && marker._point.distanceTo(point) <= 7);
  }
  function containsEvent(event) {
    if (dead || map.dragging?.moved() || map.boxZoom?.moved() || event.target?.closest?.('.leaflet-popup,.leaflet-control,button,input,select,textarea,a')) return false;
    return hitTestLayerPoint(map.mouseEventToLayerPoint(event));
  }
  function hit(event) {
    if (dead || map.dragging?.moved() || map.boxZoom?.moved() || event.target.closest?.('.species-panel,.leaflet-popup,.leaflet-control,button,input,select,textarea,a')) return;
    const p = map.mouseEventToLayerPoint(event);
    for (let i = markers.length-1; i >= 0; i--) {
      const {marker,record} = markers[i];
      if (marker._point && marker._point.distanceTo(p) <= 7) {event.preventDefault();event.stopImmediatePropagation();openRecord(record);return;}
    }
  }
  function move(event){
    if(state.preview||event.target.closest?.('.species-panel,.leaflet-popup,.surface,.leaflet-control')){clearHover();return;}
    const p=map.mouseEventToLayerPoint(event);const hit=[...markers].reverse().find(({marker})=>marker._point&&marker._point.distanceTo(p)<=7);
    if(!hit){clearHover();return;}const name=treeSpecies(hit.record.feature);highlight(name);
    if(!tooltip){tooltip=L.tooltip({className:'tree-name-tooltip',direction:'top',offset:[0,-8],opacity:1}).setLatLng(hit.marker.getLatLng()).setContent(document.createTextNode(name)).addTo(map);}else tooltip.setLatLng(hit.marker.getLatLng()).setContent(document.createTextNode(name));
  }
  function keyboardPreview(){
    const record=state.records[selected];if(!record||state.preview)return;const name=treeSpecies(record.feature);highlight(name);const [lng,lat]=record.feature.geometry.coordinates;
    if(!tooltip)tooltip=L.tooltip({className:'tree-name-tooltip',direction:'top',offset:[0,-8],opacity:1}).setLatLng([lat,lng]).setContent(document.createTextNode(name)).addTo(map);
    else tooltip.setLatLng([lat,lng]).setContent(document.createTextNode(name));
  }
  function key(event) {
    if (!state.records.length || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key.startsWith('Arrow')) {selected = (selected + (['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1) + state.records.length) % state.records.length; const [lng,lat] = state.records[selected].feature.geometry.coordinates; if (!map.getBounds().contains([lat,lng])) map.panTo([lat,lng],{animate:false});}
    keyboardLabel();keyboardPreview(); if (event.key === 'Enter' || event.key === ' ') openRecord(state.records[selected]);
  }
  container.addEventListener('mousemove',move);container.addEventListener('mouseleave',clearHover);canvas.addEventListener('focus',keyboardPreview);canvas.addEventListener('blur',clearHover);container.addEventListener('click',hit,true); canvas.addEventListener('keydown',key);
  return {
    async show(villageId, options = {}) {return loader.show(String(villageId),options);},
    clear() {loader.clear();},
    containsEvent, hitTestLayerPoint, closeRecord, isRecordOpen:()=>!sidebar.hidden,
    destroy() {if (dead) return; loader.clear(); loader.destroy(); dead = true; resetRender();sidebar.remove();rawDetails.remove();rawToggle.remove();container.removeEventListener('mousemove',move);container.removeEventListener('mouseleave',clearHover);container.removeEventListener('click',hit,true);canvas.removeEventListener('keydown',key);map.removeLayer(group);map.removeLayer(renderer);pane.remove();delete map._panes[paneName];title.remove();message.remove();caveat.remove();retry.remove();legend.remove();}
  };
}
