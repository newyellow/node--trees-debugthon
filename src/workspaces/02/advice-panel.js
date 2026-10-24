import {readAdviceStream} from './advice-stream.js';
import {API, createClient, identityWarning, safeHTTPS} from '../03/model.js';
import {exactPlants, lookupName, normalizeName, referenceImage} from './flora-lookup.js';
import {createWikiFigureSession, createWikiImages, scientificName} from '../../shared/wiki-plant-images.js';

export const INITIAL_MESSAGES = Object.freeze({
  planting: '請像懂植物的朋友，先用一句四區綠網未來願景，再連結本里公開資料，推薦2至3種可供現勘評估的樹。約120至180個中文字、短段落，不先問卷、不列長篇免責；願景是構想，不是全里適種保證。請附可精確核對的植物用名，讓介面配來源照片。',
  home: '請像懂植物的朋友，先用一句綠生活願景連結本里公開資料，再分明亮陽台、較少光室內兩種情境推薦植物；少光不等於無光。約120至180個中文字、短段落，不推定我家日照、寵物或安全，不先問卷；最多一句選答問題放最後。請附精確植物用名讓介面配來源照片。'
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
export function createAdvicePanel({base='/',container,onVision=()=>{},onClose=()=>{},fetcher=(...args)=>fetch(...args),media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')}={}) {
  if (!container?.append) throw Error('建議面板需要 container');
  const panel=el('aside'); panel.className='advice-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','AI 植物建議');panel.tabIndex=-1;
  const heading=el('h2'),closeButton=button('✕');closeButton.className='advice-close';closeButton.setAttribute('aria-label','關閉 AI 建議');
  const notice=el('p','對話由 AI 處理並可能保留，請勿提供個資。建議僅供參考，適地性與人寵安全仍需確認。');notice.className='advice-notice';
  const policy=el('p'),log=el('div');log.className='advice-log';log.setAttribute('role','log');log.setAttribute('aria-label','建議對話');log.setAttribute('aria-live','polite');log.setAttribute('aria-relevant','additions');
  const status=el('p');status.className='advice-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const form=el('form'),label=el('label','想進一步聊聊？'),input=el('textarea');form.className='advice-composer';form.hidden=true;input.name='message';input.maxLength=1200;input.rows=3;label.append(input);
  const send=el('button','傳送');send.type='submit';const retry=button('重試'),stop=button('停止');retry.hidden=true;stop.hidden=true;
  const controls=el('div');controls.className='advice-controls';controls.append(retry,stop);form.append(label,send);const footnotes=el('footer');footnotes.className='advice-footnotes';footnotes.append(notice,policy);panel.append(closeButton,heading,log,status,form,controls,footnotes);container.append(panel);
  const flora=createClient(fetcher),wikiResolver=createWikiImages({fetcher});let figures=createWikiFigureSession({resolver:wikiResolver});
  let generation=0,controller,busy=false,current,trigger,history=[],last=null,visionPlayed=false,composerReady=false,tourHandle=null;
  function busyState(value){busy=value;panel.setAttribute('aria-busy',String(value));form.hidden=!composerReady;send.disabled=value;stop.hidden=!value;input.disabled=value;}
  function cancelImages(){flora.cancel();figures.cancel();figures=createWikiFigureSession({resolver:wikiResolver});}
  function cancel({reveal=true,notify=true}={}){generation++;controller?.abort();tourHandle?.cancel?.();tourHandle=null;cancelImages();const wasBusy=busy;if(reveal&&!panel.hidden)composerReady=true;busyState(false);for(const node of log.querySelectorAll('.advice-answer[aria-hidden]'))node.removeAttribute('aria-hidden');if(wasBusy&&notify){panel.dataset.phase='cancelled';status.textContent='已停止，可繼續提問或重試。';retry.hidden=!last;}}
  function close(focus=true){cancel({reveal:false,notify:false});panel.hidden=true;composerReady=false;form.hidden=true;onClose();if(focus&&trigger?.isConnected)trigger.focus({preventScroll:true});}
  function appendTurn(role,text){const row=el('article');row.className='advice-turn advice-turn--'+role;const answer=el('p',text);answer.className='advice-answer';row.append(el('h3',role==='user'?'你':'建議'),answer);log.append(row);while(log.children.length>16)log.firstElementChild.remove();return row;}
  async function pictures(host,plants,token){
    if(!plants.length)return;host.append(el('p','植物參考照片，非本里現存樹木或適種鑑定。'));
    for(const plant of plants){
      if(token!==generation||panel.hidden)return;const section=el('section');section.className='advice-plant-images';section.append(el('h4',plant.name));host.append(section);
      if(!lookupName(plant.name)||(plant.scientificName!==undefined&&!scientificName(plant.scientificName))){section.append(el('p','缺少可確認的植物用名，未配圖。'));continue;}
      try{
        const url=new URL(API);url.searchParams.set('q',plant.name);url.searchParams.set('limit','12');const matches=referenceCandidates(await flora.get(url.href),plant);
        if(token!==generation||panel.hidden)return;if(!matches.length){section.append(el('p','暫無可確認身分的參考照片。'));continue;}
        if(matches.length>1)section.append(el('p','同名植物候選 '+matches.length+' 筆，以下以學名分列，尚未確定分類身分。'));
        for(const p of matches.slice(0,2)){
          const figure=el('figure'),image=referenceImage(p);section.append(figure);
          if(image){const img=el('img');img.alt=plant.name+'｜'+p.scientific_name+'（參考照片，非現存樹鑑定）';img.loading='lazy';img.referrerPolicy='no-referrer';img.src=image.url;const cap=el('figcaption',plant.name+' · '+p.scientific_name+' · '+image.attribution+' · '+image.license+' · ');cap.append(link('圖片來源',image.source));figure.append(img,cap);img.addEventListener('error',()=>{if(token===generation){img.remove();cap.prepend('照片無法載入 · ');}},{once:true});}
          else figure.append(el('figcaption',plant.name+' · '+p.scientific_name+'：暫無參考照片。'));figures.attach(figure,p,image,{blocked:!!identityWarning(p)});
        }
      }catch{if(token===generation)section.append(el('p','參考照片暫時未能載入。'));}
    }
  }
  async function request(message,{repeat=false,initial=false}={}){
    if(busy||panel.hidden)return;
    message=String(message).trim().slice(0,1200);if(!message)return;
    cancel({reveal:false,notify:false});const token=generation;controller=new AbortController();const signal=controller.signal;
    const prior=boundedHistory(history);if(!repeat){last={message,history:prior,initial};if(!initial)appendTurn('user',message);}else if(!last)return;
    if(repeat?last.initial:initial)composerReady=false;
    const payload={villageId:current.id,mode:current.mode,message,history:[...(repeat?last.history:prior)]};
    while(new TextEncoder().encode(JSON.stringify(payload)).byteLength>15000&&payload.history.length)payload.history.shift();
    retry.hidden=true;busyState(true);panel.dataset.phase='loading';status.textContent='正在整理建議…';
    const currentController=controller,timer=setTimeout(()=>currentController.abort(),60000),clearNetworkTimer=()=>clearTimeout(timer);signal.addEventListener('abort',clearNetworkTimer,{once:true});let failureText='暫時未能回覆，請重試。';
    try{
      const response=await fetcher(adviceEndpoint(base),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/x-ndjson'},signal,body:JSON.stringify(payload)});
      if(!response.ok){if(response.status===429){const seconds=Number(response.headers?.get('Retry-After'));failureText=seconds>0&&seconds<=3600?'回覆暫時忙碌，可約 '+Math.ceil(seconds)+' 秒後重試。':'回覆暫時忙碌，請稍後重試。';}throw Error('HTTP '+response.status);}
      let row,answer,tourNote='',tourFinished=Promise.resolve();
      const startTour=()=>{if(current.mode==='planting'&&!visionPlayed&&!media?.matches){visionPlayed=true;try{const handle=onVision()||null;tourHandle=handle;tourFinished=Promise.resolve(handle?.finished).catch(()=>{if(token===generation&&!signal.aborted){handle?.cancel?.();tourNote='導覽暫時未能完成，仍可繼續討論。';}});}catch{tourNote='導覽暫時無法開啟，仍可繼續討論。';}}};
      const delta=text=>{if(token!==generation||signal.aborted||panel.hidden)return;if(!row){cancelImages();row=appendTurn('assistant','');answer=row.querySelector('.advice-answer');row.setAttribute('aria-live','off');answer.setAttribute('aria-hidden','true');panel.dataset.phase='streaming';status.textContent='';if(initial||last?.initial)startTour();}answer.textContent+=text;};
      const result=validateAdvice(await readAdviceStream(response,{signal,onDelta:delta}));clearNetworkTimer();if(token!==generation||signal.aborted||panel.hidden)return;
      if(!row)delta(result.answer);
      if(result.tour)startTour();
      if(tourHandle){panel.dataset.phase='tour';status.textContent='願景導覽進行中…';}
      await tourFinished;if(token!==generation||signal.aborted||panel.hidden)return;
      answer.removeAttribute('aria-hidden');row.removeAttribute('aria-live');history=boundedHistory([...payload.history,{role:'user',content:message},{role:'assistant',content:result.answer}]);
      if(result.sources.length){const sources=el('details'),summary=el('summary','參考來源'),list=el('ul');sources.className='advice-sources';for(const source of result.sources){const item=el('li');item.append(source.url?link(source.title,source.url):el('span',source.title));list.append(item);}sources.append(summary,list);row.append(sources);}
      composerReady=true;panel.dataset.phase='ready';status.textContent=tourNote;last=null;input.value='';void pictures(row,result.plants,token);
    }catch{if(token===generation&&!panel.hidden){tourHandle?.cancel?.();for(const node of log.querySelectorAll('.advice-answer[aria-hidden]'))node.removeAttribute('aria-hidden');composerReady=true;panel.dataset.phase='error';status.textContent=signal.aborted?'回覆逾時，可重試或繼續提問。':failureText;retry.hidden=false;}}
    finally{clearNetworkTimer();signal.removeEventListener('abort',clearNetworkTimer);if(token===generation){tourHandle=null;busyState(false);}}
  }
  form.addEventListener('submit',event=>{event.preventDefault();void request(input.value);});retry.onclick=()=>{if(last)void request(last.message,{repeat:true,initial:last.initial});};stop.onclick=()=>cancel();closeButton.onclick=()=>close();
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
  const pagehide=()=>close(false);globalThis.addEventListener?.('pagehide',pagehide);
  return {open({village,mode='planting',trigger:source}={}){
    if(!village || typeof village.id!=='string' || !village.id.trim() || village.id.length>100 || !Object.hasOwn(INITIAL_MESSAGES,mode))throw Error('需要有效所選里與建議模式');
    cancel({reveal:false,notify:false});composerReady=false;current={id:village.id,mode};trigger=source||document.activeElement;history=[];last=null;visionPlayed=false;log.replaceChildren();input.value='';retry.hidden=true;
    heading.textContent=[village.district,village.name||village.id].filter(Boolean).join('・')+'｜'+(mode==='planting'?'種樹建議':'居家植物');
    policy.textContent=mode==='planting'?'四區綠網為構想示意，非已核定方案；適種與施工仍需現地查核。':'里內資料不代表家中環境；室內與陽台選擇仍須依實際光照、空間與人寵條件確認。';
    panel.hidden=false;panel.dataset.mode=mode;panel.dataset.villageId=village.id;closeButton.focus({preventScroll:true});busyState(false);void request(INITIAL_MESSAGES[mode],{initial:true});
  },close,cancel,isOpen:()=>!panel.hidden,destroy(){close(false);globalThis.removeEventListener?.('pagehide',pagehide);panel.remove();}};
}
