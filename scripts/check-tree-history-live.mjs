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
  await p.locator('#filters').waitFor({state:'visible'});
  assert.equal(await p.locator('#rows tr').count(),expected.entries.length);
  await p.getByLabel('樹種',{exact:true}).fill('大王椰子');
  assert.equal(await p.locator('#rows tr').count(),expected.entries.filter(e=>e.species.some(s=>s.includes('大王椰子'))).length);
  await p.getByRole('button',{name:'清除篩選'}).click();
  await p.waitForFunction(n=>document.querySelectorAll('#rows tr').length===n,expected.entries.length);
  await p.getByLabel('全文搜尋',{exact:true}).fill('寒櫻');
  assert.equal(await p.locator('#rows tr').count(),1);
  await p.locator('summary').first().click();
  assert.match(await p.locator('details').first().textContent(),/2019-11-27/);
  assert.match(await p.locator('blockquote').first().textContent(),/100株/);
  await p.getByRole('button',{name:'清除篩選'}).click();
  await p.waitForFunction(n=>document.querySelectorAll('#rows tr').length===n,expected.entries.length);
  await p.getByLabel('全文搜尋',{exact:true}).fill('does-not-exist-assertion');
  assert.equal(await p.locator('#rows tr').count(),0);await p.locator('#empty').waitFor({state:'visible'});
  await p.getByRole('button',{name:'清除篩選'}).click();
  await p.waitForFunction(n=>document.querySelectorAll('#rows tr').length===n,expected.entries.length);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const dataRequests=requests.filter(u=>new URL(u).pathname.includes('/data/'));
  assert.deepEqual(dataRequests.map(u=>new URL(u).pathname),[base.pathname+'data/tree-cultural-stories.json']);
  for(const format of ['json','csv']){const response=await p.request.get(new URL('data/tree-cultural-stories.'+format,base).href);assert.equal(response.status(),200);assert.equal(await response.text(),await readFile(new URL('../public/data/tree-cultural-stories.'+format,import.meta.url),'utf8'));}
  await p.screenshot({path:'test-results/tree-history-real-'+width+'.png',fullPage:true});
  await p.getByRole('link',{name:'返回樹木故事',exact:true}).click();
  await p.getByRole('link',{name:'歷史文化資料表',exact:true}).click();
  await p.locator('#filters').waitFor({state:'visible'});
  assert.equal((await p.reload()).status(),200);
  assert.deepEqual(errors,[]);await p.close();
  console.log('PASS real research '+width+'px: '+expected.entries.length+' rows, species/search/no-results, source details, exact downloads, direct reload and story backlinks');
 }
}finally{await browser.close();}
