import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const url=process.env.TREES_TEST_URL || 'http://127.0.0.1:5180/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
// Deliberately stub all remote base-map tiles: business data are real local snapshots.
await page.route('**/*',route=>{
 const u=new URL(route.request().url());
 if(u.hostname==='127.0.0.1'||u.hostname==='localhost')return route.continue();
 if(u.hostname.includes('tile.openstreetmap.org'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eef1e8"/><path d="M0 128H256M128 0V256" stroke="#dce1d7"/></svg>'});
 return route.abort();
});
await mkdir('test-results',{recursive:true});
async function waitText(selector,text){await page.waitForFunction(([s,t])=>document.querySelector(s)?.textContent.includes(t),[selector,text],{timeout:60000})}
async function clickCoordinate(coordinate){
 const point=await page.locator('.leaflet-tile-loaded').first().evaluate((tile,[lng,lat])=>{const [z,x,y]=new URL(tile.src).pathname.split('/').slice(1).map(v=>parseInt(v));const scale=256*2**z,sin=Math.sin(lat*Math.PI/180),r=tile.getBoundingClientRect();return{x:r.x+((lng+180)/360*scale-x*256)*r.width/256,y:r.y+((.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale-y*256)*r.height/256}},coordinate);
 await page.mouse.click(point.x,point.y);
}
try{
 await page.goto(url,{waitUntil:'domcontentloaded'});await waitText('#map-notice','全覽模式');
 await page.locator('#species-mode').click();await waitText('#species-status','162,369');
 assert.ok((await page.locator('#species-status').textContent()).includes('162,344'));
 assert.equal(await page.locator('#map .cluster-wrap').count(),0,'species groups must use canvas, not point DOM');
 assert.ok(await page.locator('#species-options input').count()>400);
 await page.locator('#species-search').fill('榕樹');
 await page.locator('#species-options input[value="榕樹"]').check();await page.waitForTimeout(300);
 const color=await page.locator('#species-options label').filter({has:page.locator('input[value="榕樹"]')}).locator('i').evaluate(e=>e.style.backgroundColor);
 await page.locator('#species-search').fill('樟樹');await page.locator('#species-options input[value="樟樹"]').check();await page.waitForTimeout(300);
 assert.equal(await page.locator('#species-legend>div').count(),2);
 await page.screenshot({path:'test-results/species-distribution.png'});
 await page.selectOption('#species-level','district');await page.waitForFunction(()=>document.querySelectorAll('#species-units button').length===12);
 await page.locator('#species-units button').filter({hasText:'大安區'}).click();await waitText('#species-unit-detail','Shannon');
 assert.ok((await page.locator('#species-unit-detail').textContent()).includes('自然對數'));
 assert.ok((await page.locator('#species-unit-detail').textContent()).includes('枯木狀態'));
 const regions=JSON.parse(await readFile(new URL('../public/data/regions.json',import.meta.url)));
 const street=JSON.parse(await readFile(new URL('../public/data/street-trees.geojson',import.meta.url)));
 const i=regions.membership['street-trees'].findIndex(v=>v>=0&&regions.features[v].properties.district==='大安區');
 await page.waitForTimeout(500);await clickCoordinate(street.features[i].geometry.coordinates);
 await page.locator('.leaflet-popup .species-popup').waitFor();
 assert.ok(await page.locator('.leaflet-popup .species-chart-row').count()>3);
 await page.waitForTimeout(500);await page.screenshot({path:'test-results/species-district.png'});await page.keyboard.press('Escape');
 await page.selectOption('#species-level','village');await page.waitForFunction(()=>document.querySelectorAll('#species-units button').length===456);
 await page.locator('#species-units button').first().click();await waitText('#species-unit-detail','來源名稱豐富度');
 await page.selectOption('#species-level','park');await page.waitForFunction(()=>document.querySelectorAll('#species-units button').length>100);
 await page.locator('#species-units button').filter({hasText:'大安森林公園'}).first().click();await waitText('#species-unit-detail','非公園邊界');
 await page.screenshot({path:'test-results/species-park.png'});
 await page.locator('#species-street-trees').uncheck();await waitText('#species-status','72,011');
 await page.locator('#species-park-trees').uncheck();await waitText('#species-status','至少一個');
 await page.locator('#species-street-trees').check();await waitText('#species-status','90,358');
 await page.selectOption('#species-level','distribution');await page.locator('#species-clear').click();await page.locator('#species-search').fill('榕樹');
 assert.equal(await page.locator('#species-options label').filter({has:page.locator('input[value="榕樹"]')}).locator('i').evaluate(e=>e.style.backgroundColor),color);
 await page.selectOption('#district','大安區');await page.locator('#search').fill('枯木');await page.locator('#search').press('Enter');await page.waitForTimeout(400);
 // Existing point/density/sidewalk interactions must still work after species mode.
 await page.locator('#point-mode').click();assert.equal(await page.locator('#point-mode').getAttribute('aria-pressed'),'true');
 await page.locator('#reset-map').click();await page.locator('#density-mode').click();await waitText('#cell-area','250 m');
 await page.selectOption('#analysis-shape','district');await waitText('#analysis-status','456 里／12 區');
 await page.selectOption('#analysis-shape','sidewalk');await page.locator('#zoom-sidewalk').click();await waitText('#analysis-status','段已分析');
 assert.equal(await page.locator('#summary-unit').textContent(),'段人行道');
 await page.locator('#species-mode').click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'test-results/species-mobile.png',fullPage:true});
 // One test-only label injection checks that source text is never interpreted as markup.
 const parkData=JSON.parse(await readFile(new URL('../public/data/park-trees.geojson',import.meta.url)));
 const hostile='<img src=x onerror="window.__speciesXss=1">';
 parkData.features[0].properties.ParkName=hostile;parkData.features[0].properties.TreeType=hostile;
 await page.route('**/data/park-trees.geojson',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(parkData)}));
 await page.goto(url,{waitUntil:'domcontentloaded'});await waitText('#map-notice','全覽模式');await page.locator('#species-mode').click();await waitText('#species-status','162,369');
 await page.selectOption('#species-level','park');await page.locator('#species-units button').filter({hasText:hostile}).click();
 assert.ok((await page.locator('#species-unit-detail').textContent()).includes(hostile));
 assert.equal(await page.locator('#species-controls img,.leaflet-tooltip img,.leaflet-popup img').count(),0);
 assert.equal(await page.evaluate(()=>window.__speciesXss),undefined);
 assert.deepEqual(errors,[]);
 console.log('PASS species: real 162369 records, known/missing/status counts, search/multiselect/stable colors, canvas grouping, 12 districts/456 villages, park groups, unit map popup/chart, independent sources, mobile, existing point/density/sidewalk restoration. Remote basemaps stubbed; no imagery/provider requests.');
}finally{await browser.close()}
