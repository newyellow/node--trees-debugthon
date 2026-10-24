import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
// Import is test-only; fixture never enters the public build.
import {readFile} from 'node:fs/promises';
const fixtureSource=await readFile(new URL('../tests/stories-research.test.mjs',import.meta.url),'utf8');
const fixture=(await import('data:text/javascript,'+encodeURIComponent(fixtureSource.slice(fixtureSource.indexOf('export const fixture'),fixtureSource.indexOf("test('research schema"))))).fixture;
const base=new URL(process.env.TREES_PORTAL_URL||'http://127.0.0.1:5191/');
const url=new URL('stories/research/index.html',base).href;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();
const requests=[],errors=[];let fail=false;
page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>{
 const path=new URL(route.request().url());
 if(path.pathname===base.pathname+'data/tree-cultural-stories.json')return route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fixture)});
 if(path.origin!==base.origin)return route.abort();
 return route.continue();
});
await mkdir('test-results',{recursive:true});
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});requests.length=0;
  assert.equal((await page.goto(url)).status(),200);await page.locator('#filters').waitFor({state:'visible'});
  assert.equal(await page.locator('#rows tr').count(),2);
  assert.match(await page.locator('#message').textContent(),/2 筆／共 2/);
  assert.equal(await page.locator('#rows img').count(),0,'source text is not interpreted as HTML');
  assert.equal(await page.getByRole('link',{name:'返回首頁',exact:true}).getAttribute('href'),base.pathname+'index.html');
  assert.equal(await page.getByRole('link',{name:'返回樹木故事',exact:true}).getAttribute('href'),base.pathname+'stories/index.html');
  for(const format of ['JSON','CSV'])assert.equal(await page.getByRole('link',{name:'下載 '+format}).getAttribute('href'),base.pathname+'data/tree-cultural-stories.'+format.toLowerCase());
  await page.getByLabel('樹種',{exact:true}).fill('樹甲');assert.equal(await page.locator('#rows tr').count(),1);
  await page.getByLabel('地點',{exact:true}).fill('地乙');await page.locator('#empty').waitFor({state:'visible'});
  await page.getByRole('button',{name:'清除篩選'}).click();await page.waitForFunction(()=>document.querySelectorAll('#rows tr').length===2);assert.equal(await page.locator('#rows tr').count(),2);
  await page.getByLabel('全文搜尋',{exact:true}).fill('alpha beta');assert.equal(await page.locator('#rows tr').count(),1);
  await page.getByRole('button',{name:'清除篩選'}).click();await page.waitForFunction(()=>document.querySelectorAll('#rows tr').length===2);
  await page.getByRole('combobox',{name:/查證狀態/}).selectOption('lead');assert.equal(await page.locator('#rows tr').count(),1);assert.match(await page.locator('#rows').textContent(),/待查線索/);
  await page.getByRole('button',{name:'清除篩選'}).click();await page.waitForFunction(()=>document.querySelectorAll('#rows tr').length===2);
  await page.locator('summary').first().click();
  assert.equal(await page.getByRole('link',{name:'測試原文',exact:true}).getAttribute('href'),'https://example.org/test-a');
  assert.match(await page.locator('details').first().textContent(),/發布日期：未標示/);
  assert.match(await page.locator('blockquote').first().textContent(),/alpha beta/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no document overflow');
  assert.deepEqual(requests.filter(x=>new URL(x).pathname.includes('/data/')).map(x=>new URL(x).pathname),[base.pathname+'data/tree-cultural-stories.json']);
  await page.screenshot({path:'test-results/stories-research-'+width+'.png',fullPage:true});
 }
 fail=true;await page.reload();await page.locator('#retry').waitFor({state:'visible'});assert.match(await page.locator('#message').textContent(),/無法載入/);
 fail=false;await page.getByRole('button',{name:'重新載入'}).click();await page.locator('#filters').waitFor({state:'visible'});assert.equal(await page.locator('#rows tr').count(),2);
 await page.reload();await page.locator('#filters').waitFor({state:'visible'});await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'跳至主要內容');
 assert.deepEqual(errors,[]);
 console.log('PASS research desktop/mobile, safe source rendering, filters/counts/no results/reset, retry503, prefix-aware links, only small research JSON loaded; base='+base.pathname);
}finally{await browser.close();}
