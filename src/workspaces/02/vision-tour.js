/** A bounded presentation, not a model-controlled map command or surveyed boundary. */
export function createVisionTour({map,camera,leaflet:L,host,getRegions,getBasemap,setBasemap,media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let generation=0,active=null,timers=[];
 function clear(){for(const timer of timers)clearTimer(timer);timers=[];}
 function removePresentation(){if(!active)return;active.banner?.remove();if(active.group)map.removeLayer(active.group);host.classList.remove('vision-tour-active');host.dataset.visionTour='idle';}
 function cancel(reason='cancel',{restoreBasemap=true}={}){
  if(!active)return;generation++;clear();camera.cancel();const saved=active.saved;removePresentation();active=null;
  if(restoreBasemap&&getBasemap()!==saved.basemap)setBasemap(saved.basemap);return reason;
 }
 const schedule=(fn,delay,token)=>{timers.push(setTimer(()=>{if(active&&token===generation)fn();},delay));};
 function start(knowledge){
  cancel();if(!knowledge||!Array.isArray(knowledge.regions)||knowledge.regions.length!==4)return false;camera.cancel();
  const token=++generation,center=map.getCenter(),saved={center:{lat:center.lat,lng:center.lng},zoom:map.getZoom(),basemap:getBasemap()};
  const banner=document.createElement('section');banner.className='vision-tour-banner surface';banner.setAttribute('aria-label','四區綠網願景導覽');
  const title=document.createElement('h3');title.textContent='四區植群 × 都市綠網願景（構想示意）';const text=document.createElement('p');text.textContent=knowledge.principle;
  const note=document.createElement('p');note.className='vision-tour-note';note.textContent='使用者提供、未獨立驗證；虛線為行政區關聯示意，不是精確植群界線。操作地圖可立即中止。';
  const stop=document.createElement('button');stop.type='button';stop.textContent='停止導覽';stop.onclick=()=>cancel('stop');banner.append(title,text,note,stop);host.append(banner);
  active={saved,banner,group:null};host.dataset.visionTour='playing';
  if(media?.matches){text.textContent=knowledge.principle+' '+knowledge.regions.map(r=>r.name+'：'+r.plants.join('、')).join('；');note.textContent+=' 已啟用減少動態：不移動鏡頭。';schedule(()=>{removePresentation();active=null;clear();},10000,token);return true;}
  const paneName='vision-concepts';let pane=map.getPane(paneName);if(!pane){pane=map.createPane(paneName);pane.style.zIndex='495';pane.style.pointerEvents='none';}
  const group=L.featureGroup().addTo(map),colors=['#7653a2','#32875f','#bb7137','#367da7'],districts=getRegions()?.districts||[];
  active.group=group;const allBounds=L.latLngBounds([]);
  for(const [i,region]of knowledge.regions.entries()){
   const features=districts.filter(f=>region.districts.includes(f.properties.district));if(!features.length)continue;
   const outlines=L.geoJSON({type:'FeatureCollection',features},{pane:paneName,interactive:false,style:{color:colors[i],weight:3,dashArray:'8 6',fill:false,opacity:.9}}).addTo(group);const bounds=outlines.getBounds();allBounds.extend(bounds);
   const label=document.createElement('div');label.textContent=region.name+'｜關聯示意';L.marker(bounds.getCenter(),{pane:paneName,interactive:false,keyboard:false,icon:L.divIcon({className:'vision-region-label',html:label,iconSize:[180,36],iconAnchor:[90,18]})}).addTo(group);
  }
  host.classList.add('vision-tour-active');setBasemap('terrain');
  if(allBounds.isValid())camera.fit(allBounds,{paddingTopLeft:[30,70],paddingBottomRight:[innerWidth<=760?30:Math.min(460,innerWidth*.4)+30,180],maxZoom:12,duration:.7});
  for(let i=0;i<4;i++)schedule(()=>{const region=knowledge.regions[i];text.textContent=region.name+'：與'+region.districts.join('、')+'的綠網延伸關聯；來源列名包括'+region.plants.join('、')+'。仍須確認真實環境與物種，並非全區適種判定。';},i*2000+500,token);
  schedule(()=>{removePresentation();setBasemap(saved.basemap);camera.run({center:saved.center,zoom:saved.zoom},{duration:.7});},9000,token);
  schedule(()=>{active=null;clear();host.dataset.visionTour='idle';},10000,token);return true;
 }
 const input=event=>{if(!active)return;if(event.target?.closest?.('.vision-tour-banner'))return;cancel('user-input');};
 const container=map.getContainer();for(const type of ['pointerdown','wheel','touchstart','keydown'])container.addEventListener(type,input,{capture:true,passive:true});
 const pagehide=()=>cancel('pagehide');globalThis.addEventListener?.('pagehide',pagehide);const reduced=()=>{if(active&&media.matches)cancel('reduced-motion');};media?.addEventListener?.('change',reduced);
 return {start,cancel,isActive:()=>!!active,destroy(){cancel('destroy');for(const type of ['pointerdown','wheel','touchstart','keydown'])container.removeEventListener(type,input,true);globalThis.removeEventListener?.('pagehide',pagehide);media?.removeEventListener?.('change',reduced);}};
}
