import { explorerUrl } from './browser-test-helpers.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], photos = [], snapshots = [];
const baseUrl = explorerUrl;
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if(/\/(?:wmts|__aerial-cache)\/PHOTO/.test(request.url()))photos.push(request.url());
  if(request.url().includes('/data/'))snapshots.push(request.url());
});
await mkdir('test-results',{recursive:true});
try {
  await page.goto(baseUrl);
  await page.waitForFunction(()=>document.querySelector('#map-notice').textContent.includes('全覽模式'));
  assert.equal(photos.length,0,'street mode must not request aerial tiles');
  const count=await page.locator('#visible-count').textContent(), requested=snapshots.length;
  await page.locator('#basemap-aerial').click();
  await page.locator('.aerial-tiles .leaflet-tile-loaded').first().waitFor({timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#basemap-status').textContent.startsWith('國土測繪中心正射航照'),null,{timeout:45000});
  assert.equal(await page.locator('.street-tiles').count(),0);
  assert.ok(photos.length > 0);
  assert.ok(photos.every(url=>new URL(url).hostname==='wmts.nlsc.gov.tw' || (new URL(url).origin===new URL(baseUrl).origin && new URL(url).pathname.startsWith('/__aerial-cache/'))));
  assert.ok((await page.locator('.leaflet-control-attribution').textContent()).includes('國土測繪中心'));
  assert.equal(await page.locator('#visible-count').textContent(),count);
  assert.ok((await page.locator('#aerial-controls').textContent()).includes('拍攝日期'));
  assert.deepEqual(await page.locator('#aerial-year option').evaluateAll(options=>options.map(o=>o.value)),['latest','2025','2024','2023','2022']);
  for(const year of ['2022','2023','2024','2025','latest']){
    const layer=year==='latest'?'PHOTO2':`PHOTO${year}`;
    await page.selectOption('#aerial-year',year);
    await page.waitForFunction(({layer,year})=>{
      const tile=document.querySelector('.aerial-tiles .leaflet-tile-loaded');
      return (tile?.src.includes(`/wmts/${layer}/`) || tile?.src.includes(`/__aerial-cache/${layer}/`))&&document.querySelector('#basemap-status').textContent.startsWith('國土測繪中心正射航照')&&document.querySelector('#map').dataset.aerialYear===year;
    },{layer,year},{timeout:45000});
    assert.equal(await page.locator('#visible-count').textContent(),count,'year changes must preserve viewport and data');
    assert.ok((await page.locator('.leaflet-control-attribution').textContent()).includes(year==='latest'?'最新拼接版':`${year} 年度版`));
  }
  assert.ok(photos.every(url=>['PHOTO2','PHOTO2022','PHOTO2023','PHOTO2024','PHOTO2025'].includes(new URL(url).pathname.split('/')[2])));
  assert.equal(snapshots.length,requested,'year changes must not refetch business data');
  await page.locator('#aerial-detail').click();
  await page.waitForFunction(()=>document.querySelector('#zoom-label').textContent==='ZOOM 17');
  await page.waitForFunction(()=>document.querySelector('#basemap-status').textContent.startsWith('國土測繪中心正射航照'),null,{timeout:45000});
  await page.waitForTimeout(300);
  await page.screenshot({path:'test-results/aerial-overlay.png'});
  const zoomedCount=await page.locator('#visible-count').textContent();
  await page.locator('#basemap-blend').click();
  await page.locator('#aerial-opacity').fill('35');
  assert.equal(await page.locator('#aerial-opacity-value').textContent(),'35%');
  const opacity=await page.locator('.aerial-tiles').evaluate(el=>getComputedStyle(el).opacity);
  assert.equal(Number(opacity),.35);
  assert.equal(await page.locator('.street-tiles').count(),1);
  await page.selectOption('#aerial-year','2024');
  await page.waitForFunction(()=>document.querySelector('#basemap-status').textContent.includes('2024 年度版'),null,{timeout:45000});
  assert.equal(Number(await page.locator('.aerial-tiles').evaluate(el=>getComputedStyle(el).opacity)),.35);
  await page.locator('#overlay-visibility').uncheck();
  assert.equal(await page.locator('.leaflet-points-pane').evaluate(el=>getComputedStyle(el).visibility),'hidden');
  assert.equal(await page.locator('#visible-count').textContent(),zoomedCount);
  await page.locator('#overlay-visibility').check();
  assert.equal(await page.locator('.leaflet-points-pane').evaluate(el=>getComputedStyle(el).visibility),'visible');
  assert.equal(snapshots.length,requested,'basemap controls must not refetch data');
  await page.locator('#density-mode').click();
  await page.selectOption('#analysis-shape','village');
  await page.waitForFunction(()=>document.querySelector('#analysis-status').textContent.includes('456 里／12 區'));
  assert.equal(await page.locator('#map').getAttribute('data-basemap'),'blend');
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'test-results/aerial-mobile.png',fullPage:true});
  await page.locator('#basemap-street').click();
  assert.equal(await page.locator('.aerial-tiles').count(),0);
  assert.ok(!(await page.locator('.leaflet-control-attribution').textContent()).includes('國土測繪中心'));
  assert.deepEqual(errors,[]);
  // Simulate provider failure, verify explicit retry and switching back to street.
  const failure=await browser.newPage();
  const aerialPattern = /\/(?:wmts|__aerial-cache)\/PHOTO2\//;
  await failure.route(aerialPattern,route=>route.fulfill({status:503,body:'Unavailable'}));
  await failure.goto(baseUrl);
  await failure.locator('#basemap-aerial').click();
  await failure.locator('#tile-error').waitFor();
  await failure.unroute(aerialPattern);
  await failure.locator('#retry-basemap').click();
  await failure.locator('.aerial-tiles .leaflet-tile-loaded').first().waitFor({timeout:45000});
  await failure.locator('#basemap-street').click();
  assert.equal(await failure.locator('.aerial-tiles').count(),0);
  console.log('PASS: all 2022–2025 year layers and latest load, attribution updates, viewport/data and opacity persist, no older-year requests or data refetch, basemap modes, village overlay, mobile layout, and failure/retry.');
} finally { await browser.close(); }
