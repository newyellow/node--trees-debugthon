import {createStoryMediaLoader,appendStoryMedia} from './story-media.js';
import {queryStories,createStoryQueryLoader} from './story-query.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function createStoryPanel({base,fetcher}) {
 const loader=createStoryQueryLoader({base,fetcher}),media=createStoryMediaLoader({base,fetcher});let generation=0;
 return {cancel(){generation++;}, async show(host,{species,village,district,coverageHost=host}) {
  const token=++generation;if(coverageHost!==host)coverageHost.replaceChildren();host.dataset.phase='loading';host.dataset.species=species;host.replaceChildren(el('h3',species+'｜文化故事'),el('p','研究目錄載入中；尚未查詢不代表沒有歷史。'));
  try {
   const catalogue=await loader.load();if(token!==generation)return;
   const result=queryStories(catalogue,{species,village,district});if(!['local','regional','general','leads'].some(k=>result[k].length)){host.dataset.phase='empty';host.replaceChildren();return;}host.dataset.phase='ready';host.replaceChildren(el('h3',species+'｜文化故事'));
   const coverage=result.metadata?.coverageNote||catalogue.coverageNote;if(coverage){const details=el('details');details.className='research-coverage';details.append(el('summary','研究覆蓋限制'),el('p','探索性研究，非全市普查；場域故事不直接證明這筆現存樹木的歷史。'),el('p',coverage));coverageHost.append(details);}
   for(const [key,title] of [['local','本里明確記載'],['regional','同區記載（非本里證據）'],['general','其他地點／物種背景'],['leads','待查線索（未核實）']]) {
    if(!result[key].length)continue;const section=el('section');section.dataset.storyGroup=key;section.append(el('h4',title));

    for(const entry of result[key]){
     const article=el('article');article.dataset.storyId=entry.id;
     const reading=el('div'),photos=el('div'),summary=el('p',entry.summary),sources=el('details');reading.className='story-reading';photos.className='story-photo-group';summary.className='story-summary';sources.className='story-provenance';
     reading.append(photos,summary);
     if(entry.storyText?.length){const text=el('details');text.className='story-text';text.append(el('summary','閱讀完整故事'),...entry.storyText.map(p=>el('p',p)));reading.append(text);}
     sources.append(el('summary','來源與限制（'+entry.sources.length+'）'),el('p',entry.limitations));
     if(entry.imageNote){const note=el('p',entry.imageNote);note.className='story-photo-note';sources.append(note);}
     for(const image of entry.images??[])sources.append(el('p','圖片使用說明：'+image.rightsNote));
     for(const source of entry.sources||[]){try{const url=new URL(source.url);if(!['https:','http:'].includes(url.protocol))continue;const a=el('a',source.title||source.url);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';sources.append(a,el('p',source.publisher+' · '+(source.publishedAt||'未標示日期')));}catch{/* Non-public document references are not links. */}}
     article.append(el('h5',entry.title),reading,el('p',[entry.location,entry.period].filter(Boolean).join(' · ')),sources);section.append(article);
     void media.load().then(entries=>{if(token===generation&&article.isConnected)appendStoryMedia(photos,entries[entry.id],base,sources);}).catch(()=>{});
    }host.append(section);
   }

  }catch(error){if(token!==generation)return;host.dataset.phase='error';host.replaceChildren(el('p','研究目錄載入失敗，尚未完成查詢；不是沒有歷史。'+error.message));const b=el('button','重試故事查詢');b.type='button';b.onclick=()=>this.show(host,{species,village,district,coverageHost});host.append(b);}
 }};
}
