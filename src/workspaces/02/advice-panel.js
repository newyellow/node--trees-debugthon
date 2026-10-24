import {API, createClient, identityWarning, safeHTTPS} from '../03/model.js';
import {exactPlants, lookupName, normalizeName, referenceImage} from './flora-lookup.js';
import {createWikiFigureSession, createWikiImages, scientificName} from '../../shared/wiki-plant-images.js';

export const INITIAL_MESSAGES = Object.freeze({
  planting: '請依這個里的資料提供初步種樹建議，說明四區綠網願景；區分藍圖、待覆核資料與現地調查，不將建議當作已核定種植計畫。',
  home: '請協助我選居家植物，先詢問日照、空間與寵物等條件；不需要地址，不將四區藍圖的 19 個原圖用名直接當作適合所有居家的清單。'
});
export const boundedHistory = history => (Array.isArray(history) ? history : []).filter(m => ['user','assistant'].includes(m?.role) && typeof m.content === 'string').slice(-8).map(m => ({role:m.role,content:m.content.slice(0,1200)}));
// Root-scoped proxy even when static assets use /review/. No remote origin from base.
export function adviceEndpoint(base = '/', origin = globalThis.location?.origin) {
  void base;
  return new URL('/api/plant-advice', origin).href;
}
export function validateAdvice(value) {
  if (!value || typeof value.answer !== 'string' || !value.answer.trim() || value.answer.length > 12000 || !Array.isArray(value.plants) || !Array.isArray(value.sources) || value.plants.length > 16 || value.sources.length > 20) throw Error('AI 回應格式不符');
  if (value.plants.some(p => typeof p?.name !== 'string' || !p.name.trim() || p.name.length > 100 || (p.scientificName !== undefined && (typeof p.scientificName !== 'string' || p.scientificName.length > 150)))) throw Error('植物資料格式不符');
  if (value.sources.some(s => typeof s?.title !== 'string' || !s.title.trim() || s.title.length > 300 || (s.url !== undefined && (typeof s.url !== 'string' || s.url.length > 1200)))) throw Error('來源資料格式不符');
  if (value.requestId !== undefined && (typeof value.requestId !== 'string' || value.requestId.length > 200)) throw Error('請求識別格式不符');
  return {answer:value.answer,plants:value.plants.slice(0,4).map(p => ({name:p.name,scientificName:p.scientificName})),sources:value.sources.map(s => ({title:s.title,url:safeHTTPS(s.url)})),tour:value.tour?.kind === 'four-region-vision',requestId:value.requestId};
}
export function referenceCandidates(data,plant){
 const name=lookupName(plant.name),latin=scientificName(plant.scientificName);if(!name||(plant.scientificName!==undefined&&!latin))return [];
 return exactPlants(data,name).filter(p=>scientificName(p.scientific_name)&&!identityWarning(p)&&(!latin||normalizeName(p.scientific_name)===latin));
}
export function confirmedPlant(data,plant){const matches=referenceCandidates(data,plant);return matches.length===1?matches[0]:null;}
const el = (tag,text) => { const node=document.createElement(tag); if(text !== undefined) node.textContent=text; return node; };
const button = text => {const node=el('button',text);node.type='button';return node;};
const link = (title,url) => {const node=el('a',title);node.href=url;node.target='_blank';node.rel='noopener noreferrer';return node;};

/** Mount once. open starts a fresh village/mode conversation (one initial POST).
 * village: {id,name,district}; close returns focus; cancel retains prior turns.
 * onVision is called once per planting conversation, only for structured tour intent.
 * Import advice-panel.css from integrating entry. No browser Gateway state is used.
 */
export function createAdvicePanel({base='/',container,onVision=()=>{},onClose=()=>{},fetcher=(...args)=>fetch(...args)}={}) {
  if (!container?.append) throw Error('建議面板需要 container');
  const panel=el('aside'); panel.className='advice-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','AI 植物建議');panel.tabIndex=-1;
  const heading=el('h2'),closeButton=button('✕');closeButton.className='advice-close';closeButton.setAttribute('aria-label','關閉 AI 建議');
  const notice=el('p','AI 試用：訊息與所選里的公開資料會交由 AI 處理，對話可能保留於服務端；請勿提供地址、姓名或其他個資。回覆可能有誤，並非現地鑑定、寵物安全或施工保證。');notice.className='advice-notice';
  const policy=el('p'),log=el('div');log.className='advice-log';log.setAttribute('role','log');log.setAttribute('aria-label','建議對話');log.setAttribute('aria-live','polite');log.setAttribute('aria-relevant','additions');
  const status=el('p');status.className='advice-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const form=el('form'),label=el('label','補充條件或繼續提問（最多 1200 字）'),input=el('textarea');input.name='message';input.maxLength=1200;input.rows=3;label.append(input);
  const send=el('button','傳送');send.type='submit';const retry=button('手動重試'),stop=button('取消產生');retry.hidden=true;stop.hidden=true;
  const controls=el('div');controls.className='advice-controls';controls.append(send,retry,stop);form.append(label,controls);panel.append(closeButton,heading,notice,policy,log,status,form);container.append(panel);
  const flora=createClient(fetcher),wikiResolver=createWikiImages({fetcher});let figures=createWikiFigureSession({resolver:wikiResolver});
  let generation=0,controller,busy=false,current,trigger,history=[],last=null,visionPlayed=false,cooldown=0;
  function busyState(value){busy=value;panel.setAttribute('aria-busy',String(value));send.disabled=value;stop.hidden=!value;input.disabled=value;}
  function cancelImages(){flora.cancel();figures.cancel();figures=createWikiFigureSession({resolver:wikiResolver});}
  function cancel(){generation++;controller?.abort();cancelImages();const wasBusy=busy;busyState(false);if(wasBusy){status.textContent='已取消產生；先前回覆已保留。';retry.hidden=!last;}}
  function close(focus=true){cancel();panel.hidden=true;onClose();if(focus&&trigger?.isConnected)trigger.focus({preventScroll:true});}
  function appendTurn(role,text){const row=el('article');row.className='advice-turn advice-turn--'+role;row.append(el('h3',role==='user'?'你':'AI 建議'),el('p',text));log.append(row);while(log.children.length>16)log.firstElementChild.remove();return row;}
  async function pictures(host,plants,token){
    if(!plants.length)return;host.append(el('p','物種參考照片，非所選里現存樹木。僅查完全同中文名的 API 資料；有同名候選時分列學名，不自動合併分類或判定適種。'));
    for(const plant of plants){
      if(token!==generation||panel.hidden)return;const section=el('section');section.className='advice-plant-images';section.append(el('h4',plant.name));host.append(section);
      if(!lookupName(plant.name)||(plant.scientificName!==undefined&&!scientificName(plant.scientificName))){section.append(el('p','缺少可確認的植物用名，未配圖。'));continue;}
      try{
        const url=new URL(API);url.searchParams.set('q',plant.name);url.searchParams.set('limit','12');const matches=referenceCandidates(await flora.get(url.href),plant);
        if(token!==generation||panel.hidden)return;if(!matches.length){section.append(el('p','沒有同中文名且身分相符的 API 資料，未以近似名稱配圖。'));continue;}
        if(matches.length>1)section.append(el('p','同名 API 候選 '+matches.length+' 筆（最多展示前兩筆參考照）；以下分類身分未合併，也不代表 AI 已選定。'));
        for(const p of matches.slice(0,2)){
          const figure=el('figure'),image=referenceImage(p);section.append(figure);
          if(image){const img=el('img');img.alt=plant.name+'｜'+p.scientific_name+'（API 候選參考照，非現存樹鑑定）';img.loading='lazy';img.referrerPolicy='no-referrer';img.src=image.url;const cap=el('figcaption',plant.name+' · '+p.scientific_name+' · '+image.attribution+' · '+image.license+' · ');cap.append(link('圖片來源',image.source));figure.append(img,cap);img.addEventListener('error',()=>{if(token===generation){img.remove();cap.prepend('照片無法載入 · ');}},{once:true});}
          else figure.append(el('figcaption',plant.name+' · '+p.scientific_name+'：暫無 API 參考照片。'));figures.attach(figure,p,image,{blocked:!!identityWarning(p)});
        }
      }catch{if(token===generation)section.append(el('p','參考照片查詢未完成；請稍後再試，未用近似植物替代。'));}
    }
  }
  async function request(message,{repeat=false}={}){
    if(busy || panel.hidden)return;
    if(Date.now()<cooldown){status.textContent='服務限流，約 '+Math.ceil((cooldown-Date.now())/1000)+' 秒後可手動重試。';return;}
    message=String(message).trim().slice(0,1200);if(!message)return;
    cancel();const token=generation;controller=new AbortController();const signal=controller.signal;
    const prior=boundedHistory(history);if(!repeat){last={message,history:prior};appendTurn('user',message);}else if(!last)return;
    const payload={villageId:current.id,mode:current.mode,message,history:[...(repeat?last.history:prior)]};
    while(new TextEncoder().encode(JSON.stringify(payload)).byteLength>15000&&payload.history.length)payload.history.shift();
    retry.hidden=true;busyState(true);status.textContent='AI 正在產生建議…';
    const timer=setTimeout(()=>{if(controller?.signal===signal)controller.abort();},60000);
    try{
      const response=await fetcher(adviceEndpoint(base),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},signal,body:JSON.stringify(payload)});
      if(!response.ok){if(response.status===429){const raw=response.headers?.get('Retry-After'),seconds=Number(raw);cooldown=Math.max(Date.now()+1000,raw && Number.isFinite(seconds)?Date.now()+seconds*1000:Date.parse(raw)||Date.now()+60000);}throw Error('HTTP '+response.status);}
      const result=validateAdvice(await response.json());if(token!==generation || signal.aborted || panel.hidden)return;
      cancelImages();history=boundedHistory([...payload.history,{role:'user',content:message},{role:'assistant',content:result.answer}]);
      const row=appendTurn('assistant',result.answer);
      if(result.sources.length){const sources=el('details'),summary=el('summary','AI 引用來源（仍需覆核）'),list=el('ul');for(const s of result.sources){const item=el('li');item.append(s.url?link(s.title,s.url):el('span',s.title+'（未提供可用來源網址）'));list.append(item);}sources.append(summary,list);row.append(sources);}
      status.textContent='已收到 AI 回覆。';last=null;input.value='';
      // Structured intent only. Home mode never invokes map navigation.
      if(current.mode==='planting'&&result.tour&&!visionPlayed){visionPlayed=true;try{onVision();}catch{status.textContent='已收到回覆；願景導覽暫時無法開啟。';}}
      void pictures(row,result.plants,token);
    }catch{if(token===generation && !panel.hidden){status.textContent=Date.now()<cooldown?'服務限流，約 '+Math.ceil((cooldown-Date.now())/1000)+' 秒後可手動重試。':signal.aborted?'產生逾時；請手動重試。':'AI 服務未完成回覆，請手動重試。先前回覆已保留。';retry.hidden=false;}}
    finally{clearTimeout(timer);if(token===generation)busyState(false);}
  }
  form.addEventListener('submit',event=>{event.preventDefault();void request(input.value);});retry.onclick=()=>{if(last)void request(last.message,{repeat:true});};stop.onclick=cancel;closeButton.onclick=close;
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
  return {open({village,mode='planting',trigger:source}={}){
    if(!village || typeof village.id!=='string' || !village.id.trim() || village.id.length>100 || !Object.hasOwn(INITIAL_MESSAGES,mode))throw Error('需要有效所選里與建議模式');
    cancel();current={id:village.id,mode};trigger=source||document.activeElement;history=[];last=null;visionPlayed=false;log.replaceChildren();input.value='';retry.hidden=true;
    heading.textContent=[village.district,village.name||village.id].filter(Boolean).join('・')+'｜'+(mode==='planting'?'種樹建議':'居家植物');
    policy.textContent=mode==='planting'?'四區綠網是規劃藍圖，非已核定方案；適地適種仍需覆核現地、管線、日照與維護條件。':'居家建議會依日照、空間與寵物等條件討論；不把藍圖的 19 個原圖用名一律當作室內植物。';
    panel.hidden=false;panel.dataset.mode=mode;panel.dataset.villageId=village.id;closeButton.focus({preventScroll:true});void request(INITIAL_MESSAGES[mode]);
  },close,cancel,isOpen:()=>!panel.hidden};
}

