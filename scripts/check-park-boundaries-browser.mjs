import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { explorerUrl,stubRemoteTiles } from './browser-test-helpers.mjs';
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
 for (const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
  const context = await browser.newContext({viewport,acceptDownloads:true});
  const page = await context.newPage(), errors=[], requests=[];
  page.on('pageerror',e=>errors.push(e.message)); page.on('request',r=>requests.push(r.url()));
  await stubRemoteTiles(page);
  await page.goto(explorerUrl);
  await page.waitForFunction(()=>document.querySelectorAll('.layer-card').length===5);
  await page.locator('#park-outline-enabled').check();
  await page.waitForFunction(()=>document.querySelectorAll('#park-select option').length>100);
  const value = await page.locator('#park-select option').evaluateAll(os=>os.find(o=>o.textContent.startsWith('大安森林公園 ·')).value);
  await page.selectOption('#park-select',value);
  await page.waitForFunction(()=>document.querySelector('#park-boundary-status').dataset.match==='matched');
  assert.equal(await page.locator('.park-candidate').count(),1);
  if (name === 'desktop') {
    await page.locator('#park-outline-enabled').uncheck();
    // fitBounds schedules point rendering; wait for the actual marker frame.
    await page.waitForFunction(() => document.querySelector('#zoom-label').textContent === 'ZOOM 17' && !document.querySelector('#map-notice').textContent.includes('正在載入'));
    const xy = await page.locator('.leaflet-tile-loaded').first().evaluate(tile => {
      const [z,tx,ty] = new URL(tile.src).pathname.split('/').slice(1).map(v=>parseInt(v));
      const lng=121.5358429,lat=25.0333004, scale=256*2**z,sin=Math.sin(lat*Math.PI/180),r=tile.getBoundingClientRect();
      return {x:r.x+((lng+180)/360*scale-tx*256)*r.width/256,y:r.y+((.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale-ty*256)*r.height/256};
    });
    await page.mouse.click(xy.x,xy.y);
    await page.waitForFunction(()=>document.querySelector('#park-outline-enabled').checked);
    await page.keyboard.press('Escape');
  }
  assert.ok(await page.locator('.leaflet-parkOutlines-pane path').count()>0);
  await page.locator('[data-decision="confirmed"]').click();
  await page.locator('.park-review-state').filter({hasText:'已在此瀏覽器確認候選'}).waitFor();
  await page.reload(); await page.locator('#park-outline-enabled').check();
  await page.waitForFunction(()=>document.querySelectorAll('#park-select option').length>100);
  await page.selectOption('#park-select',value);
  await page.locator('.park-review-state').filter({hasText:'已在此瀏覽器確認候選'}).waitFor();
  await page.locator('[data-decision="rejected"]').click();
  assert.match(await page.locator('.park-review-state').textContent(),/否決/);
  const downloadPromise = page.waitForEvent('download'); await page.locator('#park-review-export').click();
  const download = await downloadPromise; await download.saveAs('test-results/park-review-'+name+'.json');
  await page.locator('#park-review-reset').click(); assert.equal(await page.locator('.park-review-state').textContent(),'本機尚未審查');
  for (const mode of ['density','species','point']) {
   await page.locator('#'+mode+'-mode').click();
   assert.ok(await page.locator('.leaflet-parkOutlines-pane path').count()>0,'independent outline survives '+mode);
  }
  await page.locator('#overlay-visibility').uncheck();
  assert.equal(await page.locator('.leaflet-parkOutlines-pane').evaluate(e=>getComputedStyle(e).visibility),'hidden');
  await page.locator('#overlay-visibility').check();
  await page.locator('#park-outline-enabled').uncheck(); assert.equal(await page.locator('.leaflet-parkOutlines-pane path').count(),0);
  await page.locator('#park-outline-enabled').check();
  await page.locator('#park-boundary-title').scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/park-boundaries-'+name+(new URL(explorerUrl).pathname.startsWith('/review/')?'-prefix':'')+'.png',fullPage:true});
  assert.equal(requests.filter(u=>u.includes('overpass')).length,0);
  const expected = new URL('../data/park-boundaries-osm.geojson',explorerUrl).href;
  assert.ok(requests.includes(expected));
  assert.deepEqual(errors,[]);
  await context.close(); console.log(name+' park boundary browser PASS');
 }
 // A failed static snapshot is explicit and manual retryable.
 const page = await browser.newPage(); await stubRemoteTiles(page); let failed=true;
 await page.route('**/data/park-boundaries-osm.geojson',route=>failed?route.fulfill({status:503,body:'unavailable'}):route.continue());
 await page.goto(explorerUrl); await page.locator('#park-outline-enabled').check();
 await page.locator('#park-boundary-status').filter({hasText:'503'}).waitFor(); failed=false;
 await page.locator('#park-boundary-retry').click();
 await page.waitForFunction(()=>document.querySelectorAll('#park-select option').length>100);
 console.log('snapshot failure/manual retry PASS');
} finally { await browser.close(); }
