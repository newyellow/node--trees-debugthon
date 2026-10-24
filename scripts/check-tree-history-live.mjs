import {filterEntries} from '../src/stories/research-model.js';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const expected=JSON.parse(await readFile(new URL('../public/data/tree-cultural-stories.json',import.meta.url),'utf8'));
const base=new URL(process.env.TREES_PORTAL_URL||'http://127.0.0.1:5196/');
const browser=await chromium.launch({channel:'chrome',headless:true});
await mkdir('test-results',{recursive:true});
try{
 for(const width of [1440,390]){
  const p=await browser.newPage({viewport:{width,height:1000}}),requests=[],errors=[];
  p.on('request',r=>requests.push(r.url()));p.on('pageerror',e=>errors.push(e.message));
  await p.goto(new URL('stories/research/index.html',base).href);
  await p.locator('#filters').waitFor({state:'visible'});await p.locator('#coverage-details').waitFor({state:'visible'});
  assert.equal(await p.locator('#rows tr').count(),expected.entries.length);
  await p.getByLabel('樹種',{exact:true}).fill('大王椰子');
  assert.equal(await p.locator('#rows tr').count(),expected.entries.filter(e=>e.species.some(s=>s.includes('大王椰子'))).length);
  await p.getByRole('button',{name:'清除篩選'}).click();
  await p.waitForFunction(n=>document.querySelectorAll('#rows tr').length===n,expected.entries.length);
  await p.getByLabel('全文搜尋',{exact:true}).fill('寒櫻');
  assert.equal(await p.locator('#rows tr').count(),filterEntries(expected.entries,{query:'寒櫻'}).length);
  await p.locator('#rows summary').first().click();
  assert.match(await p.locator('#rows details').first().textContent(),/2019-11-27/);
  assert.match(await p.locator('blockquote').first().textContent(),/100株/);
  await p.getByRole('button',{name:'清除篩選'}).click();
  await p.waitForFunction(n=>document.querySelectorAll('#rows tr').length===n,expected.entries.length);
  await p.getByLabel('全文搜尋',{exact:true}).fill('does-not-exist-assertion');
  assert.equal(await p.locator('#rows tr').count(),0);await p.locator('#empty').waitFor({state:'visible'});
  await p.getByRole('button',{name:'清除篩選'}).click();
  await p.waitForFunction(n=>document.querySelectorAll('#rows tr').length===n,expected.entries.length);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const dataRequests=requests.filter(u=>new URL(u).pathname.includes('/data/'));
  assert.deepEqual(dataRequests.map(u=>new URL(u).pathname).sort(),[base.pathname+'data/tree-cultural-stories.json',base.pathname+'data/tree-history-search-coverage.json'].sort());
  for(const format of ['json','csv']){const response=await p.request.get(new URL('data/tree-cultural-stories.'+format,base).href);assert.equal(response.status(),200);assert.equal(await response.text(),await readFile(new URL('../public/data/tree-cultural-stories.'+format,import.meta.url),'utf8'));}
  await p.locator('#coverage-details > summary').click();
  await p.waitForFunction(()=>document.querySelectorAll('#coverage-rows tr').length===471);
  assert.equal(await p.locator('#coverage-rows tr').count(),471);
  assert.match(await p.locator('#coverage-message').textContent(),/170.*298.*75.*223.*3/);
  await p.getByLabel('搜尋標籤、ID、狀態或查詢字串').fill('species-214');
  assert.equal(await p.locator('#coverage-rows tr').count(),1);
  assert.match(await p.locator('#coverage-rows').textContent(),/未提供名稱/);
  for(const format of ['json','csv']){const response=await p.request.get(new URL('data/tree-history-search-coverage.'+format,base).href);assert.equal(response.status(),200);assert.equal(await response.text(),await readFile(new URL('../public/data/tree-history-search-coverage.'+format,import.meta.url),'utf8'));}
  const pdfEntry=expected.entries.find(e=>e.verificationStatus==='lead' && e.sources.some(s=>s.kind==='provided-document'));
  if(pdfEntry){
   await p.getByLabel('全文搜尋',{exact:true}).fill(pdfEntry.title);
   assert.equal(await p.locator('#rows tr').count(),1);
   await p.locator('#rows summary').first().click();
   assert.match(await p.locator('#rows').textContent(),/使用者提供 PDF.*印刷頁/);
   assert.equal(await p.locator('#rows a[href="null"]').count(),0);
   await p.getByRole('combobox',{name:/查證狀態/}).selectOption('lead');
   assert.equal(await p.locator('#rows tr').count(),1);
   await p.getByRole('button',{name:'清除篩選'}).click();
  }
  await p.screenshot({path:'test-results/tree-history-real-'+width+'.png',fullPage:true});
  await p.getByRole('link',{name:'返回樹木故事',exact:true}).click();
  await p.getByRole('link',{name:'歷史文化資料表',exact:true}).click();
  await p.locator('#filters').waitFor({state:'visible'});
  assert.equal((await p.reload()).status(),200);
  assert.deepEqual(errors,[]);await p.close();
  console.log('PASS real research '+width+'px: '+expected.entries.length+' rows, species/search/no-results, source details, exact downloads, direct reload and story backlinks');
 }
}finally{await browser.close();}
