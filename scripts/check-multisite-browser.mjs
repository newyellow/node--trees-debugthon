import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const root = process.env.TREES_PORTAL_URL || 'http://127.0.0.1:5191/';
const base = new URL('./',root);
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage();
const errors = []; page.on('pageerror',e=>errors.push(e.message));
await mkdir('test-results',{recursive:true});
const requests=[];page.on('request',r=>requests.push(r.url()));
// Explorer's tiles are irrelevant to navigation; business data remain real.
await page.route('**/*',r=>new URL(r.request().url()).origin === base.origin ? r.continue() : r.abort());
try {
 for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  await page.setViewportSize(viewport); requests.length=0;
  assert.equal((await page.goto(root)).status(),200);
  await page.locator('.site-card').last().waitFor();
  assert.equal(await page.locator('.site-card').count(),4);
  await page.reload(); await page.locator('.site-card').last().waitFor();
  assert.ok(requests.every(url=>new URL(url).origin===base.origin),'home has no external requests');
  assert.ok(requests.every(url=>!new RegExp('data/|leaflet|sidewalk-worker|explorer-|tile|fonts','i').test(new URL(url).pathname)),'home has no map/data/font requests');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'test-results/portal-'+viewport.width+'.png',fullPage:true});
  for(const id of ['02','03']) {
   await page.locator('a[href="'+base.pathname+'workspaces/'+id+'/index.html"]').click();
   assert.equal(new URL(page.url()).pathname,base.pathname+'workspaces/'+id+'/index.html');
   assert.equal((await page.reload()).status(),200);
   assert.equal(await page.locator('h1').textContent(),'工作區 '+id);
   assert.ok((await page.locator('main').textContent()).includes('尚無可用功能'));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:'test-results/workspace-'+id+'-'+viewport.width+'.png',fullPage:true});
   await page.getByRole('link',{name:'← 返回首頁'}).click(); await page.locator('.site-card').last().waitFor();
  }
  await page.locator('a[href="'+base.pathname+'explorer/index.html"]').click();
  await page.waitForFunction(()=>document.querySelector('#map-notice').textContent.includes('全覽模式'));
  assert.equal((await page.reload()).status(),200);
  await page.waitForFunction(()=>document.querySelector('#map-notice').textContent.includes('全覽模式'));
  assert.equal(await page.locator('.layer-card').count(),5);
  assert.ok(requests.some(url=>new URL(url).pathname===base.pathname+'data/manifest.json'));
  assert.ok(!requests.some(url=>new URL(url).pathname.startsWith('/data/') && base.pathname!=='/'));
  await page.getByRole('link',{name:'返回 Trees Debugthon 首頁'}).click();
  assert.equal(page.url(),new URL('index.html',base).href); await page.locator('.site-card').last().waitFor();
 }
 for(const path of ['stories/index.html','explorer/index.html','workspaces/02/index.html','workspaces/03/index.html']) assert.equal((await page.request.get(new URL(path,root).href)).status(),200);
 assert.equal((await page.request.get(new URL('missing-page',root).href)).status(),404,'no SPA fallback');
 await page.goto(root);await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'跳至主要內容');
 assert.deepEqual(errors,[]);
 console.log('PASS static MPA direct reloads, explicit index files, 404, root links/backlinks, desktop/mobile layout, keyboard skip link, no home external/data/map requests; base='+base.pathname);
} finally {await browser.close();}
