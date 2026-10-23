import './stories.css';
import {selectRecords, fetchCollection, SOUTH_LABELS} from './selection.js';
const $ = id => document.getElementById(id);
const cache = new Map();
let current = 'south', generation = 0, records = [], shown = [];
const text = (tag, content, className) => { const el=document.createElement(tag); el.textContent=content; if(className)el.className=className; return el; };
async function get(file) {
  if (!cache.has(file)) cache.set(file, fetchCollection(import.meta.env.BASE_URL + 'data/' + file + '.geojson').catch(error => {cache.delete(file);throw error;}));
  return cache.get(file);
}
function showRecord(record) {
  const panel = $('record-detail'); panel.replaceChildren();
  const p = record.feature.properties;
  panel.append(text('h4', p.TreeType + ' · ' + p.TreeID));
  panel.append(text('p','你選取的是現代資料紀錄，不是已確認的歷史見證樹。','draft-note'));
  const dl=document.createElement('dl');
  const fields = [['資料身分',record.key],['來源檔／feature 索引（0 起算）',record.layer + '.geojson / ' + record.index],['TreeType（原標籤）',p.TreeType],['地點原欄位',record.layer === 'park-trees' ? 'ParkName＝'+p.ParkName : 'Region＝'+p.Region+'；RegionRemark＝'+(p.RegionRemark || '（空白）')],['Dist',p.Dist],['WGS84 [經度, 緯度]',JSON.stringify(record.feature.geometry.coordinates)],['入選規則',record.reason],['SurveyDate',p.SurveyDate || '未提供'],['UpdDate',p.UpdDate || '未提供']];
  for(const [label,value] of fields) {const row=document.createElement('div');row.append(text('dt',label),text('dd',value));dl.append(row);}panel.append(dl);
  const a=text('a','查看樹木資料集來源 ↗');a.href='https://data.gov.tw/dataset/128274';a.target='_blank';a.rel='noopener noreferrer';panel.append(a);
  $('selection-note').textContent='已選取 '+record.key+'。下方文化提問不代表這棵樹的身世。';
  for(const button of $('record-list').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.key===record.key));
}
function renderList() {
  const label=$('species-filter').value;
  shown=records.filter(r=>!label || r.feature.properties.TreeType===label);
  const list=$('record-list');list.replaceChildren();
  const limit=40, page=Math.max(0,Math.min(Number($('record-page').value)||0,Math.ceil(shown.length/limit)-1));
  $('record-page').replaceChildren();
  for(let i=0;i<Math.ceil(shown.length/limit);i++) {const opt=text('option','第 '+(i+1)+' 頁');opt.value=i;$('record-page').append(opt);} $('record-page').value=page;
  $('record-page').disabled=shown.length===0;
  $('record-count').textContent='符合 '+shown.length+' 筆；每頁最多 40 筆。選擇一筆，查看原始位置與可說／不可說的故事。';
  for(const record of shown.slice(page*limit,(page+1)*limit)) {
    const p=record.feature.properties, li=document.createElement('li'), b=text('button',p.TreeType+' · '+p.TreeID+' / '+(p.ParkName || p.Region));
    b.type='button';b.dataset.key=record.key;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>showRecord(record));li.append(b);list.append(li);
  }
  if(!shown.length) list.append(text('li','目前快照沒有符合規則的紀錄。不以其他樹種或虛構點位代替。'));
  $('record-detail').replaceChildren(text('p','尚未選取資料紀錄。'));
  $('selection-note').textContent='請點選目前清單中的一筆紀錄。';
}
async function load() {
  const run=++generation;
  $('load-demo').disabled=true;$('demo-data').hidden=true;$('record-detail').replaceChildren();
  $('load-status').textContent='正在讀取既有公開資料快照…';
  try {
    const [street, park, parks]=await Promise.all([get('street-trees'),get('park-trees'),current==='mango'?get('parks'):null]);
    if(run!==generation)return;
    const result=selectRecords(current,{'street-trees':street,'park-trees':park},parks); records=result.records;
    $('anchor-note').textContent=result.anchor ? '鄰近參考：parks.geojson / SeqNo＝'+result.anchor.properties.SeqNo+'；pm_name＝青年公園；座標 '+JSON.stringify(result.anchor.geometry.coordinates)+'。1000 公尺為示範查詢半徑，不是公園、國宅或眷村邊界。無中華路國宅的可靠邊界，不宣稱點位位於國宅。' : '精確納入 TreeType：'+SOUTH_LABELS.join('、')+'。不以「椰／棕」關鍵字泛收；中文俗名不等於已鑑定學名，大王椰子也不等同可可椰子。';
    $('species-filter').replaceChildren(text('option','全部原標籤'));$('species-filter').firstChild.value='';
    for(const label of [...new Set(records.map(r=>r.feature.properties.TreeType))].sort()){const opt=text('option',label);opt.value=label;$('species-filter').append(opt);}
    $('record-page').value=0;renderList();$('demo-data').hidden=false;
    $('load-status').textContent=records.length ? '已讀取 '+records.length+' 筆符合規則的真實紀錄。' : '無符合紀錄；文化提問仍為研究草稿。';
  } catch(error) {if(run!==generation)return;$('load-status').textContent='讀取失敗：'+(error.name==='AbortError'?'超過 30 秒':error.message)+'。可按「載入／重試」重試；不顯示虛構點位。';}
  finally {if(run===generation)$('load-demo').disabled=false;}
}
for(const button of document.querySelectorAll('[data-demo]'))button.addEventListener('click',()=>{
  current=button.dataset.demo;++generation;records=[];
  for(const b of document.querySelectorAll('[data-demo]'))b.setAttribute('aria-pressed',String(b===button));
  $('south-context').hidden=current!=='south';$('mango-context').hidden=current!=='mango';
  $('demo-data').hidden=true;$('load-demo').disabled=false;$('load-status').textContent='尚未讀取此主題資料；按載入開始。';$('selection-note').textContent='請先載入資料，再點選一筆紀錄。';
});
$('load-demo').addEventListener('click',load);
$('species-filter').addEventListener('change',()=>{$('record-page').value=0;renderList();});
$('record-page').addEventListener('change',renderList);
