import {appendPlantDetails} from './plant-card.js';
import {loadCachedAdvice, playCachedAnswer, validateSelection} from './cached-advice.js';
import {API, createClient, identityWarning} from '../03/model.js';
import {exactPlants, lookupName, normalizeName, referenceImage} from './flora-lookup.js';
import {createWikiFigureSession, createWikiImages, scientificName} from '../../shared/wiki-plant-images.js';

export const INITIAL_MESSAGES = Object.freeze({
  planting: '請用四個以空白行分隔的短段落，像植物朋友聊本里的未來願景：整體山系綠網願景；有依據的研究與本里綠網機會連結；實際樹木組成與養護方向；直接行動優先序及2至3種候選。山名、鄰近、地質只用資料支持，不編造。沒有樹況證據不建議移除。約180至240字，不重複免責註記。plants請完整對應第四段所有候選，讓介面配資料庫照片與詳細介紹。',
  home: '請像植物朋友寫可獨立閱讀的完整居家建議，用空白行分成明亮陽台與室內擺飾兩組，每組1至2種，總共推薦2至4種具名植物，各給一句簡短理由。室內依明亮散射光或較少光的實際適合情境，少光不等於無光。可用有依據的山系或鄰里綠網作輕巧意象，不推定我家日照、寵物或安全，不把山系植物自動當室內適種。約120至180字，相關誤食風險短註於植物旁；不要邀請聊天、索取條件或在結尾提問。plants完整列出兩組全部候選，最多4種，讓介面配精確照片與介紹。'
});
export function referenceCandidates(data,plant){
 const name=lookupName(plant.name),latin=scientificName(plant.scientificName);if(!name||(plant.scientificName!==undefined&&!latin))return [];
 return exactPlants(data,name).filter(p=>scientificName(p.scientific_name)&&!identityWarning(p)&&(!latin||normalizeName(p.scientific_name)===latin));
}
export function confirmedPlant(data,plant){const matches=referenceCandidates(data,plant);return matches.length===1?matches[0]:null;}
export const AI_ADVICE_QUOTE='※以上建議由 AI 經由樹木資料進行生成，實際應用仍須諮詢相關領域專家';
const el = (tag,text) => { const node=document.createElement(tag); if(text !== undefined) node.textContent=text; return node; };
const button = text => {const node=el('button',text);node.type='button';return node;};
const link = (title,url) => {const node=el('a',title);node.href=url;node.target='_blank';node.rel='noopener noreferrer';return node;};

/** Pre-generated reading only. Opening/retrying reads a static shard, never inference. */
export function createAdvicePanel({base='/',container,onVision=()=>{},onClose=()=>{},fetcher=(...args)=>fetch(...args),media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')}={}) {
  if (!container?.append) throw Error('建議面板需要 container');
  const panel=el('aside');panel.className='advice-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','預生成植物建議');panel.tabIndex=-1;
  const heading=el('h2'),closeButton=button('✕');closeButton.className='advice-close';closeButton.setAttribute('aria-label','關閉預生成建議');
  const readingLabel=el('p','預生成建議・逐字播放');readingLabel.className='advice-reading-label';
  const notice=el('p','此為預生成閱讀模式，逐字播放僅在本機呈現，不是即時 AI 回覆。不傳送使用者輸入，不呼叫 AI 推論，也不產生本次推論費用；仍會讀取建議檔與植物參考資料。建議僅供參考，適地性與人寵安全仍需確認。');notice.className='advice-notice';
  const policy=el('p'),log=el('div');log.className='advice-log';log.setAttribute('aria-label','預生成建議內容');
  const status=el('p');status.className='advice-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const retry=button('重新讀取'),stop=button('停止播放');retry.hidden=true;stop.hidden=true;
  const controls=el('div');controls.className='advice-controls';controls.append(retry,stop);
  const footnotes=el('footer');footnotes.className='advice-footnotes';footnotes.append(notice,policy);panel.append(closeButton,heading,readingLabel,log,status,controls,footnotes);container.append(panel);
  const flora=createClient(fetcher),wikiResolver=createWikiImages({fetcher});let figures=createWikiFigureSession({resolver:wikiResolver});
  let generation=0,controller,busy=false,current,trigger,tourHandle=null;
  function busyState(value){busy=value;panel.setAttribute('aria-busy',String(value));stop.hidden=!value;}
  function cancelImages(){flora.cancel();figures.cancel();figures=createWikiFigureSession({resolver:wikiResolver});}
  function cancel({notify=true}={}){const wasBusy=busy;generation++;controller?.abort();tourHandle?.cancel?.();tourHandle=null;cancelImages();busyState(false);for(const node of log.querySelectorAll('.advice-answer[aria-hidden]'))node.removeAttribute('aria-hidden');if(wasBusy&&notify&&!panel.hidden){panel.dataset.phase='cancelled';status.textContent='已停止讀取或播放；可重新讀取預生成建議。';retry.hidden=false;}}
  function close(focus=true){cancel({notify:false});panel.hidden=true;onClose();if(focus&&trigger?.isConnected)trigger.focus({preventScroll:true});}
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
          else figure.append(el('figcaption',plant.name+' · '+p.scientific_name+'：暫無參考照片。'));appendPlantDetails(section,p);figures.attach(figure,p,image,{blocked:!!identityWarning(p)});
        }
      }catch{if(token===generation)section.append(el('p','參考照片暫時未能載入。'));}
    }
  }
  async function read(){
    if(busy||panel.hidden||!current)return;
    cancel({notify:false});const token=generation;controller=new AbortController();const {signal}=controller;
    const isCurrent=()=>token===generation&&!panel.hidden;
    const selection={...current,base};log.replaceChildren();retry.hidden=true;busyState(true);panel.dataset.phase='loading';status.textContent='正在讀取預生成建議…';stop.textContent='停止讀取';
    const controllerForRead=controller,timeout=setTimeout(()=>controllerForRead.abort(),30000);
    let tourNote='';
    try{
      const result=await loadCachedAdvice({...selection,fetcher,signal,isCurrent});clearTimeout(timeout);
      if(!isCurrent()||signal.aborted)return;
      const row=el('article');row.className='advice-turn advice-turn--assistant';const answer=el('p','');answer.className='advice-answer';answer.setAttribute('aria-hidden','true');row.append(el('h3','預生成建議'),answer);log.append(row);
      let tourFinished=Promise.resolve();
      if(selection.mode==='planting'&&result.tour&&!media?.matches){
        try{tourHandle=onVision()||null;const handle=tourHandle;tourFinished=Promise.resolve(handle?.finished).catch(()=>{if(isCurrent()&&!signal.aborted){handle?.cancel?.();tourNote='願景導覽暫時未能完成。';}});}catch{tourNote='願景導覽暫時無法開啟。';}
      }
      panel.dataset.phase='playing';status.textContent=media?.matches?'預生成建議・直接顯示':'預生成建議・逐字播放';stop.textContent='停止播放';
      await playCachedAnswer(result.answer,{signal,isCurrent,reducedMotion:!!media?.matches,onText:text=>{answer.textContent=text;}});
      if(!isCurrent()||signal.aborted)return;
      answer.removeAttribute('aria-hidden');const quote=el('small',AI_ADVICE_QUOTE);quote.className='advice-ai-quote';answer.after(quote);
      if(result.sources.length){const sources=el('details'),summary=el('summary','參考來源'),list=el('ul');sources.className='advice-sources';for(const source of result.sources){const item=el('li');item.append(source.url?link(source.title,source.url):el('span',source.title));list.append(item);}sources.append(summary,list);row.append(sources);}
      void pictures(row,result.plants,token);
      if(tourHandle){panel.dataset.phase='tour';status.textContent='預生成建議已播放完成，願景導覽進行中…';}
      await tourFinished;if(!isCurrent()||signal.aborted)return;
      panel.dataset.phase='ready';status.textContent=tourNote||'預生成建議已閱讀完成。';retry.hidden=false;
    }catch{
      if(isCurrent()){tourHandle?.cancel?.();for(const node of log.querySelectorAll('.advice-answer[aria-hidden]'))node.removeAttribute('aria-hidden');panel.dataset.phase='error';status.textContent=signal.aborted?'讀取逾時，可重新讀取預生成建議。':'預生成建議暫時無法讀取或資料版本不符，請重新讀取。不會改用即時 AI。';retry.hidden=false;}
    }finally{clearTimeout(timeout);if(token===generation){tourHandle=null;busyState(false);}}
  }
  retry.onclick=()=>{void read();};stop.onclick=()=>cancel();closeButton.onclick=()=>close();
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
  const pagehide=()=>close(false);globalThis.addEventListener?.('pagehide',pagehide);
  return {open({village,mode='planting',trigger:source}={}){
    validateSelection(village?.id,mode);cancel({notify:false});current={villageId:village.id,mode};trigger=source||document.activeElement;log.replaceChildren();retry.hidden=true;
    heading.textContent=[village.district,village.name||village.id].filter(Boolean).join('・')+'｜'+(mode==='planting'?'種樹建議':'居家植物');
    policy.textContent=mode==='planting'?'四區綠網為構想示意，非已核定方案；適種與施工仍需現地查核。':'里內資料不代表家中環境；室內與陽台選擇仍須依實際光照、空間與人寵條件確認。';
    panel.hidden=false;panel.dataset.mode=mode;panel.dataset.villageId=village.id;closeButton.focus({preventScroll:true});void read();
  },close,cancel,isOpen:()=>!panel.hidden,destroy(){close(false);globalThis.removeEventListener?.('pagehide',pagehide);panel.remove();}};
}
