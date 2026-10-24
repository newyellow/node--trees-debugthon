import './research.css';
import {appendStoredStoryImages} from './story-media.js';
import {validateResearchData,filterEntries,SCOPES,STATUSES,safeSourceURL,validateCoverageData,filterCoverage,coverageStatus} from './research-model.js';
const $ = id => document.getElementById(id);
let data;
async function downloadRevision(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function el(tag,text,className) {
 const node = document.createElement(tag);
 if (text !== undefined) node.textContent = text;
 if (className) node.className = className;
 return node;
}
function cell(label,...children) {const td=el('td');td.dataset.label=label;td.append(...children);return td;}
function renderRow(e) {
 const row=el('tr'),details=el('details');row.dataset.storyId=e.id;
 const story=cell('摘要');appendStoredStoryImages(story,e.images??[],import.meta.env.BASE_URL);story.append(el('p',e.summary,'story-summary'));
 if(e.storyText?.length){const text=el('details',undefined,'story-text');text.append(el('summary','閱讀完整故事'),...e.storyText.map(p=>el('p',p)));story.append(text);}
 details.className='story-provenance';details.append(el('summary','查閱來源與限制（'+e.sources.length+'）'),el('p','適用限制：'+e.limitations,'limitations'));
 if(e.imageNote)details.append(el('p',e.imageNote,'story-photo-note'));
 for(const image of e.images??[])details.append(el('p','圖片使用說明：'+image.rightsNote,'story-image-rights'));
 const list=el('ol',undefined,'sources');
 for (const s of e.sources) {
  const item=el('li'),url=safeSourceURL(s.url),link=el(url?'a':'strong',s.title);if(url){link.href=url;link.rel='noopener noreferrer';}else{item.append(el('p','使用者提供 PDF · 印刷頁 '+(s.page??'未標示')+' · 文件：'+(s.documentPath??s.documentId??'未標示')));}
  item.append(link,el('p','發布者：'+s.publisher),el('p','發布日期：'+(s.publishedAt??'未標示')+' · 查閱日期：'+s.accessedAt),el('p','來源定位：'+s.locator),el('blockquote',s.excerpt));list.append(item);
 }
 details.append(list);
 row.append(cell('主題／樹種',el('h2',e.title),el('p',e.species.join('、'))),cell('地點／年代',el('p',e.location),el('p',e.period,'muted')),story,cell('查證／證據範圍',el('span',STATUSES[e.verificationStatus],'badge '+e.verificationStatus),el('p',SCOPES[e.evidenceScope])),cell('來源與限制',details));return row;
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
  const revision=await downloadRevision(data);
  for(const link of document.querySelectorAll('[aria-label="下載研究資料"] a')){const url=new URL(link.href);url.searchParams.set('v',revision);link.href=url.href;}
  $('description').textContent=data.description;$('coverage').textContent='收錄範圍：'+data.coverageNote;$('updated').textContent='資料更新：'+data.updatedAt;
  $('filters').hidden=false;render();
 }catch{$('message').textContent='研究資料暫時無法載入，請稍後重試。';$('retry').hidden=false;}
 finally{$('results').setAttribute('aria-busy','false');}
}
$('filters').addEventListener('submit',event=>event.preventDefault());
// Input covers search fields and select; duplicate change-on-blur used to replace rows during the first disclosure click.
$('filters').addEventListener('input',render);
$('filters').addEventListener('reset',()=>setTimeout(render,0));$('retry').addEventListener('click',load);load();

// Coverage is deliberately independent of the story catalogue and its retry path.
const coveragePanel=el('section',undefined,'search-coverage');coveragePanel.id='search-coverage';coveragePanel.setAttribute('aria-label','原始標籤搜尋涵蓋進度');
coveragePanel.append(el('h2','原始標籤搜尋涵蓋進度'));
const coverageMessage=el('p','正在載入搜尋涵蓋進度…');coverageMessage.id='coverage-message';coverageMessage.setAttribute('role','status');
const coverageRetry=el('button','重試搜尋進度');coverageRetry.type='button';coverageRetry.hidden=true;
const coverageDetails=el('details'),coverageSummary=el('summary','展開全部標籤與查詢紀錄');coverageDetails.id='coverage-details';coverageDetails.hidden=true;coverageDetails.append(coverageSummary);
const coverageSearchLabel=el('label','搜尋標籤、ID、狀態或查詢字串'),coverageSearch=el('input');coverageSearch.type='search';coverageSearch.id='coverage-search';coverageSearchLabel.append(coverageSearch);
const coverageCount=el('p');coverageCount.setAttribute('role','status');
const coverageTable=el('table'),coverageHead=el('thead'),coverageHeader=el('tr'),coverageRows=el('tbody');coverageRows.id='coverage-rows';
coverageTable.append(el('caption','471 個原始標籤；搜尋進度不等於故事查證結果'));
for(const title of ['原始標籤／ID','樹木紀錄數','搜尋狀態','實際請求數','實際查詢紀錄']){const th=el('th',title);th.scope='col';coverageHeader.append(th);}coverageHead.append(coverageHeader);coverageTable.append(coverageHead,coverageRows);
coverageDetails.append(coverageSearchLabel,coverageCount,coverageTable);
const coverageDownloads=el('div',undefined,'downloads');
for(const format of ['json','csv']){const link=el('a','下載搜尋進度 '+format.toUpperCase());link.href=import.meta.env.BASE_URL+'data/tree-history-search-coverage.'+format;link.download='';coverageDownloads.append(link);}
coveragePanel.append(coverageMessage,coverageRetry,coverageDownloads,coverageDetails);$('filters').before(coveragePanel);
let coverageData;
function renderCoverage(){
 if(!coverageData)return;
 const matches=filterCoverage(coverageData.entries,coverageSearch.value);
 coverageCount.textContent='顯示 '+matches.length+'／'+coverageData.entries.length+' 個標籤';
 coverageRows.replaceChildren(...matches.map(e=>{
  const row=el('tr'),queries=el('ul',undefined,'coverage-queries');
  for(const q of e.queries){const li=el('li'),url=safeSourceURL(q.requestURL),label=q.query+' · '+q.outcome,link=el(url?'a':'span',label);if(url){link.href=url;link.rel='noopener noreferrer';}li.append(link,el('p',q.accessedAt,'muted'));queries.append(li);}
  if(!e.queryCount)queries.append(el('li','未逐名發出請求；不能解讀為沒有故事'));
  row.append(cell('原始標籤／ID',el('strong',e.label||'未提供名稱'),el('p',e.id,'muted')),cell('樹木紀錄數',el('span',String(e.recordCount))),cell('搜尋狀態',el('span',coverageStatus(e))),cell('實際請求數',el('span',String(e.queryCount))),cell('實際查詢紀錄',queries));return row;
 }));
}
async function loadCoverage(){
 coveragePanel.setAttribute('aria-busy','true');coverageRetry.hidden=true;coverageMessage.textContent='正在載入搜尋涵蓋進度…';
 try{
  const response=await fetch(import.meta.env.BASE_URL+'data/tree-history-search-coverage.json');if(!response.ok)throw Error('HTTP '+response.status);
  coverageData=validateCoverageData(await response.json());const s=coverageData.summary;
  const revision=await downloadRevision(coverageData);
  for(const link of coverageDownloads.querySelectorAll('a')){const url=new URL(link.href);url.searchParams.set('v',revision);link.href=url.href;}
  coverageMessage.textContent=s.totalLabels+' 個來源標籤（不是分類學物種）；'+s.meaningfulLabels+' 個有意義標籤。'+s.statusCounts.searched+' 個取得可用搜尋結果；'+s.statusCounts['blocked-search-access']+' 個受阻（'+s.labelsWithOnlyBlockedRequests+' 個僅受阻請求、'+s.labelsBlockedWithoutIndividualRequest+' 個未逐名請求）；'+s.statusCounts['needs-name-review']+' 個名稱待核。'+s.labelsWithActualRequest+' 個有實際請求，共 '+s.actualQueryRequests+' 次。未搜尋或受阻不表示沒有故事；搜尋結果不等於有來源支持的故事。';
  coverageDetails.hidden=false;if(coverageDetails.open)renderCoverage();
 }catch{coverageMessage.textContent='搜尋涵蓋進度暫時無法載入；不影響下方故事查閱。';coverageRetry.hidden=false;}
 finally{coveragePanel.setAttribute('aria-busy','false');}
}
coverageSearch.addEventListener('input',renderCoverage);coverageDetails.addEventListener('toggle',()=>{if(coverageDetails.open)renderCoverage();});coverageRetry.addEventListener('click',loadCoverage);loadCoverage();
