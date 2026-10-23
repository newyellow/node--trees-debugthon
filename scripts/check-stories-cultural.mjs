import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const url=process.env.TREES_STORIES_URL || 'http://127.0.0.1:5193/stories/index.html';
const base=new URL('../',url);
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage(), errors=[], requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
// No tiles or external requests are needed for this accessible record-selection demo.
await page.route('**/*',route=>new URL(route.request().url()).origin===base.origin ? route.continue() : route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')}));
await mkdir('test-results',{recursive:true});
try {
for(const width of [1440,390]) {
 await page.setViewportSize({width,height:1000});requests.length=0;await page.goto(url);
 assert.ok(!requests.some(u=>u.includes('/data/')),'lazy loading');
 await page.locator('#load-demo').click();await page.waitForFunction(()=>document.querySelector('#load-status').textContent.includes('3437'));
 assert.equal(await page.locator('#record-list button').count(),40);
 await page.locator('#species-filter').selectOption('可可椰子');assert.equal(await page.locator('#record-list button').count(),20);
 await page.locator('#record-list button').first().click();assert.match(await page.locator('#record-detail').textContent(),/現代資料紀錄/);
 await page.getByRole('button',{name:'02 芒果與街區生活'}).click();await page.locator('#load-demo').click();
 await page.waitForFunction(()=>document.querySelector('#load-status').textContent.includes('203'));
 assert.match(await page.locator('#anchor-note').textContent(),/992/);
 await page.locator('#record-page').selectOption('4');
 await page.locator('[data-key="park-trees:WH0115001091"]').click();
 const detail=await page.locator('#record-detail').textContent();assert.match(detail,/121.5034871,25.0244854/);assert.match(detail,/ParkName＝青年公園/);
 assert.equal(await page.locator('#record-list button[aria-pressed="true"]').count(),1);
 await page.locator('#first-story summary').click();assert.ok(await page.locator('#first-story details').evaluate(el=>el.open));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#cultural-demos').screenshot({path:'test-results/story-cultural-'+width+'.png'});
 assert.ok(requests.filter(u=>u.includes('/data/')).every(u=>new URL(u).pathname.startsWith(base.pathname+'data/')),'base aware');
 assert.ok(!requests.some(u=>/tile|leaflet|fonts/.test(u)));
}
// A failed fetch can recover in-place without phantom rows.
await page.route('**/data/street-trees.geojson',r=>r.fulfill({status:503,body:'temporarily unavailable'}));
await page.reload();await page.locator('#load-demo').click();await page.waitForFunction(()=>document.querySelector('#load-status').textContent.includes('503'));
assert.equal(await page.locator('#demo-data').isVisible(),false);
await page.unroute('**/data/street-trees.geojson');await page.locator('#load-demo').click();await page.waitForFunction(()=>document.querySelector('#load-status').textContent.includes('3437'));
// Empty real-compatible schema must remain explicitly empty, not fallback examples.
await page.route('**/data/*-trees.geojson',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',features:[]})}));
await page.reload();await page.locator('#load-demo').click();await page.waitForFunction(()=>document.querySelector('#load-status').textContent.includes('無符合紀錄'));
assert.equal(await page.locator('#record-list button').count(),0);
assert.match(await page.locator('#record-list').textContent(),/不以其他樹種或虛構點位代替/);
assert.deepEqual(errors,[]);
console.log('PASS desktop/mobile: lazy real snapshots, exact 3437/203 counts, filters/paging, real WH0115001091 identity+coordinates, native draft disclosure, no overflow, fetch503/retry, no-match, no tiles/fonts/external fetch; base='+base.pathname);
}finally {await browser.close();}
