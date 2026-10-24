import './research.css';
import {validateResearchData,filterEntries,SCOPES,STATUSES,safeSourceURL} from './research-model.js';
const $ = id => document.getElementById(id);
let data;
function el(tag,text,className) {
 const node = document.createElement(tag);
 if (text !== undefined) node.textContent = text;
 if (className) node.className = className;
 return node;
}
function cell(label,...children) {const td=el('td');td.dataset.label=label;td.append(...children);return td;}
function renderRow(e) {
 const row=el('tr'),details=el('details');
 details.append(el('summary','查閱來源與限制（'+e.sources.length+'）'),el('p','適用限制：'+e.limitations,'limitations'));
 const list=el('ol',undefined,'sources');
 for (const s of e.sources) {
  const item=el('li'),link=el('a',s.title);link.href=safeSourceURL(s.url);link.rel='noopener noreferrer';
  item.append(link,el('p','發布者：'+s.publisher),el('p','發布日期：'+(s.publishedAt??'未標示')+' · 查閱日期：'+s.accessedAt),el('p','來源定位：'+s.locator),el('blockquote',s.excerpt));list.append(item);
 }
 details.append(list);
 row.append(cell('主題／樹種',el('h2',e.title),el('p',e.species.join('、'))),cell('地點／年代',el('p',e.location),el('p',e.period,'muted')),cell('摘要',el('p',e.summary)),cell('查證／證據範圍',el('span',STATUSES[e.verificationStatus],'badge '+e.verificationStatus),el('p',SCOPES[e.evidenceScope])),cell('來源與限制',el('p',e.limitations,'limitations'),details));return row;
}
function render() {
 if(!data)return;
 const matches=filterEntries(data.entries,Object.fromEntries(['species','location','query','status'].map(id=>[id,$(id).value])));
 $('rows').replaceChildren(...matches.map(renderRow));
 $('message').textContent='顯示 '+matches.length+' 筆／共 '+data.entries.length+' 筆研究資料';
 $('empty').hidden=matches.length!==0;$('table-wrap').hidden=matches.length===0;
}
async function load() {
 $('results').setAttribute('aria-busy','true');$('retry').hidden=true;$('message').textContent='正在載入研究資料…';
 try {
  const response=await fetch(import.meta.env.BASE_URL+'data/tree-cultural-stories.json');
  if(!response.ok)throw new Error('HTTP '+response.status);
  data=validateResearchData(await response.json());
  $('description').textContent=data.description;$('coverage').textContent='收錄範圍：'+data.coverageNote;$('updated').textContent='資料更新：'+data.updatedAt;
  $('filters').hidden=false;render();
 }catch{$('message').textContent='研究資料暫時無法載入，請稍後重試。';$('retry').hidden=false;}
 finally{$('results').setAttribute('aria-busy','false');}
}
$('filters').addEventListener('submit',event=>event.preventDefault());
$('filters').addEventListener('input',render);$('filters').addEventListener('change',render);
$('filters').addEventListener('reset',()=>setTimeout(render,0));$('retry').addEventListener('click',load);load();
