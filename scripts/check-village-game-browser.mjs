import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir,readFile } from 'node:fs/promises';
import { CAPABILITIES,dominantCapability } from '../src/workspaces/02/domain.js';
const url=process.env.VILLAGE_GAME_URL||'http://127.0.0.1:5194/workspaces/02/index.html';
const mode=process.env.TREES_STUB_TILES==='0'?'real':'stub';
const dir=new URL('../test-results/village-game-fullscreen/',import.meta.url);await mkdir(dir,{recursive:true});
const data=JSON.parse(await readFile(new URL('../public/data/village-game.json',import.meta.url)));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[],tileResponses=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('response',r=>{if(r.url().includes('tile.openstreetmap.org'))tileResponses.push(r.status());});
 if(mode==='stub')await page.route('https://*.tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e3ecdf"/></svg>'}));
 let fail=true;await page.route('**/data/village-game.json',r=>{if(fail){fail=false;return r.fulfill({status:503,body:'unavailable'});}return r.continue();});
 await page.goto(url);await page.getByText('資料載入失敗：',{exact:false}).waitFor();await page.locator('#retry').click();await page.getByText('護照已就緒',{exact:false}).waitFor();
 const shot=async name=>page.screenshot({path:new URL(mode+'-'+name+'.png',dir).pathname});
 const viewport=async()=>{assert.deepEqual(await page.locator('#map').evaluate(n=>({w:n.clientWidth,h:n.clientHeight})),await page.evaluate(()=>({w:innerWidth,h:innerHeight})));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false);};
 await viewport();assert.equal(await page.locator('#passport').isVisible(),false);assert.equal(await page.locator('#finder').isVisible(),false);
 assert.equal(await page.locator('#villages button').count(),456);assert.equal(await page.locator('path[data-village]').count(),456);
 const colors=await page.locator('path[data-village]').evaluateAll(ns=>[...new Set(ns.map(n=>n.getAttribute('fill')))]);for(const c of CAPABILITIES)assert.ok(colors.includes(c.color));assert.equal(colors.length,6);
 await page.waitForTimeout(1200);await shot('desktop-initial');
 const find=async(name)=>{await page.locator('#finder-toggle').click();await page.locator('#search').fill(name);};
 const choose=async(v)=>{await find(v.name);await page.locator('#villages button').filter({hasText:v.district+'・'+v.name}).click();await page.waitForTimeout(650);};
 const v=data.villages.find(v=>v.name==='龍安里');await choose(v);
 assert.equal(await page.locator('.card').count(),6);assert.equal(await page.locator('.score').filter({hasText:'N/A'}).count(),2);assert.equal(await page.locator('#strongest').innerText(),dominantCapability(v.scores).text);
 for(const c of CAPABILITIES){const card=page.locator('[data-capability="'+c.key+'"]');assert.equal(await card.locator('meter').getAttribute('value'),String(v.scores[c.key]));assert.equal(await card.evaluate(n=>n.style.getPropertyValue('--capability')),c.color);}
 const selected=page.locator('path[data-village="'+v.id+'"]');assert.equal(await selected.getAttribute('fill'),dominantCapability(v.scores).color);assert.equal(await selected.getAttribute('stroke-width'),'4');
 const transform=await page.locator('.leaflet-map-pane').getAttribute('style');const scroll=page.locator('#passport .panel-scroll');await scroll.hover();await page.mouse.wheel(0,700);await page.waitForTimeout(200);assert.ok(await scroll.evaluate(n=>n.scrollTop)>0);assert.equal(await page.locator('.leaflet-map-pane').getAttribute('style'),transform);
 await shot('desktop-selected');await page.keyboard.press('Escape');assert.equal(await page.locator('#passport').isVisible(),false);assert.equal(await page.locator('#passport-toggle').evaluate(n=>n===document.activeElement),true);
 await page.locator('#passport-toggle').click();assert.ok(await page.locator('#passport').isVisible());await page.keyboard.press('Escape');
 await page.locator('#finder-toggle').click();await page.locator('#district').selectOption('大安區');await page.locator('#search').fill('');assert.equal(await page.locator('#villages button').count(),53);await page.locator('#search').fill('不存在');assert.equal(await page.locator('#villages button').count(),0);await page.locator('#reset').click();assert.equal(await page.locator('#villages button').count(),456);await page.keyboard.press('Escape');
 const tie=data.villages.find(v=>dominantCapability(v.scores).kind==='tie');await choose(tie);assert.match(await page.locator('#strongest').innerText(),/多項並列最高/);await page.keyboard.press('Escape');const zero=data.villages.find(v=>dominantCapability(v.scores).kind==='neutral');await choose(zero);assert.match(await page.locator('#strongest').innerText(),/皆為0/);await page.keyboard.press('Escape');
 await choose(v);await page.keyboard.press('Escape');await page.waitForTimeout(500);
 // Pointer native SVG focus used to draw its rectangular bounds: compare computed styles with fix disabled.
 await selected.click({force:true});await page.locator('[data-close=passport]').click();await page.mouse.click(750,160);
 const diagnostic=await selected.evaluate(n=>{n.focus();const sheet=document.createElement('style');sheet.textContent='.leaflet-interactive:focus:not(:focus-visible){outline:revert!important}';document.head.append(sheet);const before={outline:getComputedStyle(n).outlineStyle,width:getComputedStyle(n).outlineWidth,focusVisible:n.matches(':focus-visible')};sheet.remove();return {before,after:{outline:getComputedStyle(n).outlineStyle,width:getComputedStyle(n).outlineWidth}};});
 assert.equal(diagnostic.after.outline,'none');
 await page.locator('#reset').focus();await page.keyboard.press('Tab');await selected.focus();assert.ok(await selected.evaluate(n=>n.matches(':focus-visible')));assert.equal(await selected.evaluate(n=>getComputedStyle(n).outlineStyle),'solid');await page.keyboard.press('Enter');assert.ok(await page.locator('#passport').isVisible());await page.keyboard.press('Escape');
 await page.locator('#legend-toggle').click();assert.equal(await page.locator('#legend-items li').count(),6);await page.keyboard.press('Escape');assert.equal(await page.locator('#legend-toggle').evaluate(n=>n===document.activeElement),true);
 await page.locator('#method-toggle').click();await page.getByText('資料來源、日期與品質稽核',{exact:true}).click();assert.match(await page.locator('#provenance').innerText(),/162,369/);await page.keyboard.press('Escape');
 await page.locator('#reset').click();await page.waitForTimeout(400);
 const map=page.locator('#map'),box=await map.boundingBox(),old=await page.locator('.leaflet-map-pane').getAttribute('style');await page.mouse.move(box.width*.5,box.height*.55);await page.mouse.down();await page.mouse.move(box.width*.5+90,box.height*.55+40,{steps:10});await page.mouse.up();await page.waitForTimeout(400);assert.notEqual(await page.locator('.leaflet-map-pane').getAttribute('style'),old);await page.locator('.leaflet-control-zoom-in').click();await page.locator('#reset').click();
 assert.match(await page.locator('.leaflet-control-attribution').innerText(),/OpenStreetMap/);
 await page.setViewportSize({width:390,height:844});await viewport();await shot('mobile-initial');await choose(v);await viewport();const mobileVillage=await selected.boundingBox();assert.ok(mobileVillage && mobileVillage.y>=105 && mobileVillage.y+mobileVillage.height<440, 'selected village visible above sheet');await shot('mobile-selected');const panel=await page.locator('#passport').boundingBox();assert.ok(panel.height<844*.5);await page.keyboard.press('Escape');await page.locator('#passport-toggle').click();await page.keyboard.press('Escape');
 await page.setViewportSize({width:667,height:375});await choose(v);await viewport();const landscapeVillage=await selected.boundingBox(),landscapePanel=await page.locator('#passport').boundingBox();assert.ok(landscapeVillage.x>=0 && landscapeVillage.x+landscapeVillage.width<landscapePanel.x,'landscape village visible beside sheet');await shot('landscape');await page.keyboard.press('Escape');await page.locator('.leaflet-control-zoom-in').click();
 assert.equal(requests.filter(u=>/street-trees.geojson|park-trees.geojson/.test(u)).length,0);for(const name of ['regions.json','village-game.json'])assert.equal(requests.filter(u=>u.endsWith('/data/'+name)).length,2);assert.deepEqual(errors,[]);
 if(mode==='real')assert.ok(tileResponses.some(s=>s===200),'actual OSM tiles loaded');
 console.log(JSON.stringify({passed:true,url,mode,diagnostic,tileResponses:tileResponses.reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{}),screenshots:dir.pathname,errors},null,2));
}finally{await browser.close();}
