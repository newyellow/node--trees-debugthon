import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const url = process.env.VILLAGE_GAME_URL || 'http://127.0.0.1:5192/workspaces/02/index.html';
const dir = new URL('../test-results/village-game/', import.meta.url); await mkdir(dir,{recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
 const page = await browser.newPage({viewport:{width:1440,height:1050}}), errors=[], requests=[];
 page.on('pageerror',e=>errors.push(e.message)); page.on('request',r=>requests.push(r.url()));
 if(process.env.TREES_STUB_TILES !== '0') await page.route('https://*.tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e3ecdf"/></svg>'}));
 let fail=true;
 await page.route('**/data/village-game.json',async r=>{if(fail){fail=false;return r.fulfill({status:503,body:'unavailable'});}return r.continue();});
 await page.goto(url); await page.getByText('資料載入失敗：',{exact:false}).waitFor();
 await page.getByRole('button',{name:'重新載入資料'}).click(); await page.getByText('護照已就緒',{exact:false}).waitFor();
 assert.equal(await page.locator('#villages button').count(),456);
 assert.equal(await page.locator('.leaflet-overlay-pane path').count(),456);
 assert.equal(await page.locator('.card').count(),6);
 assert.equal(await page.locator('.score').filter({hasText:'N/A'}).count(),2);
 const before=await page.locator('#cards').innerText();
 await page.locator('#district').selectOption('大安區'); assert.equal(await page.locator('#villages button').count(),53);
 await page.locator('#search').fill('龍安里'); assert.equal(await page.locator('#villages button').count(),1);
 await page.locator('#villages button').click(); assert.match(await page.locator('#village-title').innerText(),/龍安里/);
 await page.locator('#search').fill('古風里'); await page.locator('#villages button').click(); assert.notEqual(await page.locator('#cards').innerText(),before);
 await page.locator('#search').fill('不存在的里'); assert.equal(await page.locator('#villages button').count(),0);
 await page.getByRole('button',{name:'回到臺北全景'}).click(); assert.equal(await page.locator('.leaflet-overlay-pane path').count(),456);
 // A genuine pointer click on a known interior point, using a village fitted by the accessible list.
 await page.locator('#search').fill('龍安里'); await page.locator('#villages button').click(); await page.locator('#search').fill('');
 await page.waitForTimeout(500);
 const paths=page.locator('.leaflet-overlay-pane path');
 let clicked=false;
 for(let i=0;i<await paths.count();i++){const p=paths.nth(i),b=await p.boundingBox();if(b && b.width>30 && b.width<500 && b.height>30 && b.height<450){try{await p.click({timeout:300});clicked=true;break;}catch{}}}
 assert.ok(clicked,'polygon pointer click');
 await page.getByRole('button',{name:'回到臺北全景'}).click();
 await page.waitForTimeout(500); const map=page.locator('#map'), box=await map.boundingBox();
 const transform=await page.locator('.leaflet-map-pane').getAttribute('style');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down(); await page.mouse.move(box.x+box.width/2+80,box.y+box.height/2+40,{steps:10}); await page.mouse.up(); await page.waitForTimeout(300);
 assert.notEqual(await page.locator('.leaflet-map-pane').getAttribute('style'),transform);
 await page.locator('.leaflet-control-zoom-in').click(); await page.waitForTimeout(300);
 await page.getByRole('button',{name:'回到臺北全景'}).click();
 assert.match(await page.locator('.leaflet-control-attribution').innerText(),/OpenStreetMap/);
 await page.screenshot({path:new URL('desktop.png',dir).pathname,fullPage:true});
 await page.setViewportSize({width:390,height:844}); await page.locator('#search').fill('龍安里'); await page.locator('#villages button').click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:new URL('mobile.png',dir).pathname,fullPage:true});
 assert.equal(requests.filter(u=>u.includes('street-trees.geojson')||u.includes('park-trees.geojson')).length,0);
 // Failed attempt plus exactly one retry; regions fetched once per attempt, never per selection.
 assert.equal(requests.filter(u=>u.endsWith('/data/village-game.json')).length,2);
 assert.equal(requests.filter(u=>u.endsWith('/data/regions.json')).length,2);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({url,passed:true,screenshots:dir.pathname,errors,sourceRequests:requests.filter(u=>u.includes('/data/'))},null,2));
} finally { await browser.close(); }
