import L from 'leaflet';
import {treeSpeciesColor,updateSpeciesLegend} from './tree-species.js';
import RBush from 'rbush';
import { renderPointLayer } from '../../point-layers.js';
import { LayerScene } from '../../layer-scene.js';
import { matches } from '../../explorer.js';
import './record-layers.css';

export function createRecordLoader(load, changed = () => {}) {
  const records = new Map(); let dead = false;
  function enable(id, enabled) {
    if (!records.has(id)) records.set(id, { enabled:false, status:'idle', data:null, error:null, pending:null });
    const record = records.get(id); record.enabled = enabled;
    if (dead) return Promise.resolve();
    changed(id, record);
    if (!enabled || record.data) return Promise.resolve(record.data);
    if (record.pending) return record.pending;
    record.status = 'loading'; record.error = null; changed(id, record);
    record.pending = Promise.resolve().then(() => load(id)).then(data => { record.data=data; record.status='ready'; return data; }, error => { record.status='error'; record.error=error; return null; }).finally(() => { record.pending=null; if (!dead) changed(id,record); });
    return record.pending;
  }
  return { records, enable, destroy() { dead=true; for (const record of records.values()) record.enabled=false; } };
}

export function validateRecordDefinitions(value) {
  if (!value || !Array.isArray(value.layers)) throw new Error('圖層目錄格式錯誤');
  const ids=new Set();
  return value.layers.map(d => {
    if (!d || typeof d.id !== 'string' || !/^[a-z0-9-]+$/.test(d.id) || ids.has(d.id) || typeof d.title !== 'string' || !['point','polygon'].includes(d.kind) || typeof d.file !== 'string' || !/^[a-zA-Z0-9_./-]+\.geojson$/.test(d.file) || d.file.includes('..') || d.file.startsWith('/')) throw new Error('圖層定義格式錯誤');
    ids.add(d.id); return { ...d, color:/^#[a-f0-9]{6}$/i.test(d.color) ? d.color : '#467e72' };
  });
}

export function validateRecordCollection(value) {
  if (value?.type !== 'FeatureCollection' || !Array.isArray(value.features)) throw new Error('資料不是 FeatureCollection');
  for (const feature of value.features) {
    if (feature?.type !== 'Feature' || !feature.properties || !['Point','Polygon','MultiPolygon'].includes(feature.geometry?.type)) throw new Error('不支援的圖徵');
    const bbox=[Infinity,Infinity,-Infinity,-Infinity];
    function visit(c) {
      if (!Array.isArray(c)) throw new Error('座標格式錯誤');
      if (typeof c[0] === 'number') {
        const [x,y]=c; if (!Number.isFinite(x) || !Number.isFinite(y) || x < -180 || x > 180 || y < -90 || y > 90) throw new Error('座標超出範圍');
        bbox[0]=Math.min(bbox[0],x); bbox[1]=Math.min(bbox[1],y); bbox[2]=Math.max(bbox[2],x); bbox[3]=Math.max(bbox[3],y);
      } else c.forEach(visit);
    }
    visit(feature.geometry.coordinates); if (!bbox.every(Number.isFinite)) throw new Error('空白座標'); feature.bbox=bbox;
  }
  return value.features;
}


export function buildTreeExclusions(records=[]) {
 const result=new Map();for(const r of records){if(!['street-trees','park-trees'].includes(r.layerId)||typeof r.treeId!=='string'||!r.treeId)continue;if(!result.has(r.layerId))result.set(r.layerId,new Set());result.get(r.layerId).add(r.treeId);}return result;
}
export function filterExcludedTreeRecords(features,excluded) {return excluded?.size?features.filter(f=>!excluded.has(String(f.properties.TreeID))):features;}

export function installRecordLayers({ map, host, isCameraMoving = () => false, base = '/', onFeatureOpen = () => {} }) {
  if (!map || !host) throw new Error('Record layers require map and host');
  const root = (base.endsWith('/') ? base.slice(0,-1) : base) + '/data/';
  let dead=false, initialized=false, pendingMetadata=null, district='',exclusionVersion=0,exclusionSignature='[]';
  let exclusions=new Map(),priorityHitTest=()=>false;const views=new Map();
  function datasetView(id,data){const excluded=exclusions.get(id);if(!excluded?.size)return data;const cached=views.get(id);if(cached?.version===exclusionVersion&&cached.source===data)return cached.data;const features=filterExcludedTreeRecords(data.features,excluded);const index=new RBush();index.load(features.map(feature=>({minX:feature.bbox[0],minY:feature.bbox[1],maxX:feature.bbox[2],maxY:feature.bbox[3],feature})));const view={features,index,featureIds:data.featureIds};views.set(id,{version:exclusionVersion,source:data,data:view});return view;}
  const definitions=new Map(), rows=new Map(), scenes=new Map();
  const speciesLegend=document.createElement('section');speciesLegend.className='tree-species-legend';
  const state={district:'', query:'', opacity:new Map()};
  const prefix='record-' + L.Util.stamp(host);
  const panes={areas:prefix+'-areas', points:prefix+'-points'};
  for (const [name,paneName] of Object.entries(panes)) {
    const pane=map.createPane(paneName); pane.classList.add('record-data-pane'); pane.style.zIndex=name==='areas'?'450':'460';
  }
  const renderers=Object.fromEntries(Object.entries(panes).map(([name,pane]) => [name,L.canvas({pane,padding:0.25})]));
  async function json(path) { const response=await fetch(root+path); if (!response.ok) throw new Error('HTTP '+response.status); return response.json(); }
  const loader=createRecordLoader(async id => {
    const features=validateRecordCollection(await json(definitions.get(id).file));
    const index=new RBush(); index.load(features.map(feature => ({minX:feature.bbox[0],minY:feature.bbox[1],maxX:feature.bbox[2],maxY:feature.bbox[3],feature})));
    return {features,index,featureIds:new Map(features.map((feature,i)=>[feature,i]))};
  },()=>{if(!dead) render();});
  function featurePopup(feature,definition) {
    const box=document.createElement('section'); box.className='record-popup';
    const add=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;box.append(node);return node;};
    const name=feature.properties._name;add('h3',definition.title+(name&&name!==definition.title?' · '+name:''));
    add('p','來源擷取：'+(definition.fetchedAt?.slice(0,10)||'日期未留存')+'；非即時現況或法律認定。');if(definition.description)add('p',definition.description);
    add('p','來源：'+(definition.agency||'原始開放資料'));
    const source=definition.source||definition.url;
    if(source && (source.startsWith('https://') || source.startsWith('http://'))){const link=add('a','開啟原始資料來源');link.href=source;link.target='_blank';link.rel='noopener noreferrer';}
    const list=document.createElement('dl');box.append(list);
    const labels={TreeID:'樹木編號',TreeType:'樹種',TreeHeight:'樹高（原值）',Diameter:'胸徑（原值）',Dist:'行政區（原值）',Region:'路段',RegionRemark:'位置補充',SurveyDate:'調查日期',UpdDate:'紀錄更新',ParkName:'公園名稱'};
    for(const [key,value] of Object.entries(feature.properties)){if(key.startsWith('_'))continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=labels[key]||key;dd.textContent=typeof value==='object'?JSON.stringify(value):String(value??'');list.append(dt,dd);}
    add('p','WGS84 座標（經度、緯度）：'+JSON.stringify(feature.geometry.coordinates));return box;
  }
  function adapt(layer) {
    if(layer.eachLayer) layer.eachLayer(adapt);
    if(layer.options){const kind=layer.options.pane==='areas'?'areas':'points';layer.options.pane=panes[kind];layer.options.bubblingMouseEvents=false;if(layer instanceof L.Path)layer.options.renderer=renderers[kind];}
    layer.on('preclick',()=>onFeatureOpen());
    layer.on('popupopen',event=>{const content=event.popup.getElement();if(content&&!content.dataset.recordCapture){content.dataset.recordCapture='true';content.addEventListener('click',event=>{if(event.target.closest('.overlap-list button'))onFeatureOpen();},true);}});
    return layer;
  }
  function getScene(id){
    if(!scenes.has(id)){const group=L.layerGroup().addTo(map),scene=new LayerScene(group);scenes.set(id,{group,scene,adapter:{use:(key,version,create,...args)=>scene.use(key,version,()=>adapt(create()),...args)}});}
    return scenes.get(id);
  }
  function keyboard(renderer){
    const canvas=renderer._container;if(!canvas||canvas.dataset.recordKeyboard)return;
    canvas.dataset.recordKeyboard='true';canvas.tabIndex=0;canvas.setAttribute('role','group');
    canvas.setAttribute('aria-label','資料圖徵：方向鍵逐筆瀏覽，Enter 或空白鍵開啟');let selected=0;
    canvas.addEventListener('keydown',event=>{if(isCameraMoving())return;
      const layers=[];for(let order=renderer._drawFirst;order;order=order.next)if(order.layer.options.interactive)layers.push(order.layer);
      if(!layers.length)return;
      if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Enter',' '].includes(event.key)){
        event.preventDefault();event.stopPropagation();
        if(event.key.startsWith('Arrow'))selected=(selected+(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)+layers.length)%layers.length;
        selected%=layers.length;const layer=layers[selected];
        canvas.setAttribute('aria-label','圖徵 '+(selected+1)+' / '+layers.length+'；Enter 開啟');
        if(event.key==='Enter'||event.key===' '){const latlng=layer.getLatLng?layer.getLatLng():layer.getBounds().getCenter();layer.fire('preclick',{originalEvent:event,latlng});layer.fire('click',{originalEvent:event,latlng});}
      }
    });
  }
  function render(){
    if(dead)return;const bounds=map.getBounds(),query={minX:bounds.getWest(),minY:bounds.getSouth(),maxX:bounds.getEast(),maxY:bounds.getNorth()};
    for(const [id,definition]of definitions){
      const record=loader.records.get(id),row=rows.get(id),active=record?.enabled&&record.data;
      const displayData=active?datasetView(id,record.data):null;
      const count=active?displayData.index.search(query).filter(({feature})=>matches(feature,district,'')).length:0;
      if(active||scenes.has(id)){
        const {scene,adapter}=getScene(id);scene.begin('records:'+(exclusions.has(id)?exclusionVersion:0));
        if(active)renderPointLayer({definition,dataset:displayData,state,map,bounds,scene:adapter,featurePopup,pointColor:['street-trees','park-trees'].includes(id)?treeSpeciesColor:null,fitBounds:(bbox,maxZoom)=>map.fitBounds([[bbox[1],bbox[0]],[bbox[3],bbox[2]]],{maxZoom})});
        scene.finish();for(const renderer of Object.values(renderers))keyboard(renderer);
      }
      if(row){row.input.checked=Boolean(record?.enabled);row.status.textContent=record?.status==='loading'?'載入中…':record?.status==='error'?'載入失敗：'+(record.error?.message||'未知錯誤'):active?'目前視窗 '+count.toLocaleString('zh-TW')+' 筆'+(exclusions.get(id)?.size?'（里內樹木另以逐棵顯示）':''):record?.data?'已快取 · 未顯示':'可用 · 尚未載入';row.status.dataset.count=String(count);row.retry.hidden=record?.status!=='error';}
    }
    updateSpeciesLegend(speciesLegend,['street-trees','park-trees'].flatMap(id=>{const r=loader.records.get(id);return r?.enabled&&r.data?datasetView(id,r.data).features:[];}));
  }
  function addDefinition(definition){
    definitions.set(definition.id,definition);
    const row=document.createElement('div');row.className='record-layer-row';row.dataset.recordLayer=definition.id;
    const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.recordLayer=definition.id;input.addEventListener('change',()=>loader.enable(definition.id,input.checked));const swatch=document.createElement('span');swatch.className='record-layer-swatch';swatch.style.backgroundColor=definition.color;swatch.setAttribute('aria-hidden','true');label.append(input,swatch,document.createTextNode(definition.title));
    const status=document.createElement('small');status.dataset.recordStatus=definition.id;status.setAttribute('aria-live','polite');
    const source=document.createElement('small');source.className='record-layer-source';source.textContent='來源：'+(definition.agency||definition.source||'開放資料')+' · 擷取 '+(definition.fetchedAt?.slice(0,10)||'日期未留存')+' · 全部 '+(definition.valid??definition.total??'未知').toLocaleString('zh-TW')+' 筆';
    const retry=document.createElement('button');retry.type='button';retry.textContent='重試';retry.hidden=true;retry.onclick=()=>loader.enable(definition.id,true);
    row.append(label,status,source,retry);host.append(row);rows.set(definition.id,{row,input,status,retry});
  }
  async function ensure(){
    if(dead||initialized)return;if(pendingMetadata)return pendingMetadata;
    if(!rows.size)host.textContent='載入圖層目錄…';
    pendingMetadata=Promise.allSettled([json('manifest.json'),json('village-record-layers.json')]).then(results=>{
      if(dead)return;host.replaceChildren();let failed=false;
      results.forEach((result,index)=>{try{
        if(result.status==='rejected')throw result.reason;
        if(index===1&&result.value.schemaVersion!==1)throw new Error('補充目錄版本不支援');
        for(const item of validateRecordDefinitions(result.value).filter(d=>d.id!=='clean-bins'))if(!definitions.has(item.id))addDefinition({fetchedAt:result.value.fetchedAt,...item});
      }catch(error){failed=true;const message=document.createElement('p');message.textContent=(index?'補充':'原始')+'圖層目錄載入失敗：'+error.message;host.append(message);}});
      for(const {row}of rows.values())if(!host.contains(row))host.append(row);
      host.append(speciesLegend);initialized=!failed;if(failed){const retry=document.createElement('button');retry.type='button';retry.textContent='重試圖層目錄';retry.onclick=ensure;host.append(retry);}render();
    }).finally(()=>{pendingMetadata=null;});return pendingMetadata;
  }
  // Hit only real shapes. Empty canvas space must not steal village SVG events.
  const container=map.getContainer();
  function hitRecord(event){if(isCameraMoving())return;
    if(priorityHitTest(event))return;
    if(map.dragging?.moved() || map.boxZoom?.moved())return;
    if(event.target.closest?.('.leaflet-popup, .leaflet-marker-icon, .leaflet-control'))return;
    const point=map.mouseEventToLayerPoint(event);
    for(const renderer of Object.values(renderers).reverse())for(let order=renderer._drawLast;order;order=order.prev){const layer=order.layer;if(layer.options.interactive&&layer._containsPoint(point)){
      event.stopImmediatePropagation();event.preventDefault();const data={originalEvent:event,layerPoint:point,containerPoint:map.layerPointToContainerPoint(point),latlng:map.layerPointToLatLng(point)};
      layer.fire('preclick',data);layer.fire('click',data);return;
    }}
  }
  function hoverRecord(event){if(isCameraMoving())return;
    if(priorityHitTest(event))return;
    if(event.target.closest?.('.leaflet-popup, .leaflet-marker-icon, .leaflet-control'))return;
    const point=map.mouseEventToLayerPoint(event);
    for(const renderer of Object.values(renderers))for(let order=renderer._drawLast;order;order=order.prev)if(order.layer.options.interactive&&order.layer._containsPoint(point)){event.stopImmediatePropagation();return;}
  }
  container.addEventListener('mousemove',hoverRecord,true);container.addEventListener('mouseover',hoverRecord,true);
  container.addEventListener('click',hitRecord,true);map.on('moveend zoomend',render);
  return {ensure,setPriorityHitTest(fn){priorityHitTest=typeof fn==='function'?fn:()=>false;},setExcludedTrees(records=[]){const signature=JSON.stringify(records.map(r=>[r.layerId,String(r.treeId)]));if(signature===exclusionSignature)return;exclusionSignature=signature;exclusions=buildTreeExclusions(records);exclusionVersion++;views.clear();render();},setFilter(filter={}){district=typeof filter.district==='string'?filter.district:'';state.district=district;render();},destroy(){
    dead=true;loader.destroy();map.off('moveend zoomend',render);container.removeEventListener('click',hitRecord,true);container.removeEventListener('mousemove',hoverRecord,true);container.removeEventListener('mouseover',hoverRecord,true);
    for(const {group}of scenes.values())map.removeLayer(group);
    for(const renderer of Object.values(renderers))if(map.hasLayer(renderer))map.removeLayer(renderer);
    for(const pane of Object.values(panes)){map.getPane(pane)?.remove();delete map._panes[pane];}host.replaceChildren();
  }};
}
