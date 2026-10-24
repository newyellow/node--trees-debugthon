import {createStoryMediaLoader,appendStoryMedia} from './story-media.js';
import {queryStories,createStoryQueryLoader} from './story-query.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function createStoryPanel({base,fetcher}) {
 const loader=createStoryQueryLoader({base,fetcher}),media=createStoryMediaLoader({base,fetcher});let generation=0;
 return {cancel(){generation++;}, async show(host,{species,village,district}) {
  const token=++generation;host.dataset.phase='loading';host.dataset.species=species;host.replaceChildren(el('h3',species+'｜文化故事'),el('p','研究目錄載入中；尚未查詢不代表沒有歷史。'));
  try {
   const catalogue=await loader.load();if(token!==generation)return;
   const result=queryStories(catalogue,{species,village,district});if(!['local','regional','general','leads'].some(k=>result[k].length)){host.dataset.phase='empty';host.replaceChildren();return;}host.dataset.phase='ready';host.replaceChildren(el('h3',species+'｜文化故事'),el('p','探索性研究，非全市普查；場域故事不直接證明這筆現存樹木的歷史。'));
   const coverage=result.metadata?.coverageNote||catalogue.coverageNote;if(coverage){const details=el('details');details.append(el('summary','研究覆蓋限制'),el('p',coverage));host.append(details);}
   for(const [key,title] of [['local','本里明確記載'],['regional','同區記載（非本里證據）'],['general','其他地點／物種背景'],['leads','待查線索（未核實）']]) {
    if(!result[key].length)continue;const section=el('section');section.dataset.storyGroup=key;section.append(el('h4',title));

    for(const entry of result[key]){const article=el('article');article.dataset.storyId=entry.id;article.append(el('h5',entry.title),el('p',[entry.location,entry.period].filter(Boolean).join(' · ')),el('p',entry.summary),el('p',entry.limitations));for(const s of entry.sources||[]){try{const u=new URL(s.url);if(!['https:','http:'].includes(u.protocol))continue;const a=el('a',s.title||s.url);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';article.append(a);}catch{ /* Invalid links are not navigation. */ }}section.append(article);void media.load().then(entries=>{if(token===generation&&article.isConnected)appendStoryMedia(article,entries[entry.id]);}).catch(()=>{});}host.append(section);
   }

  }catch(error){if(token!==generation)return;host.dataset.phase='error';host.replaceChildren(el('p','研究目錄載入失敗，尚未完成查詢；不是沒有歷史。'+error.message));const b=el('button','重試故事查詢');b.type='button';b.onclick=()=>this.show(host,{species,village,district});host.append(b);}
 }};
}
