import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {cameraIdle} from './browser-test-helpers.mjs';
const url=process.env.VILLAGE_GAME_URL||'http://127.0.0.1:5209/workspaces/02/index.html';
const out=homedir()+'/.openclaw/media/social-camera';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
try{for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:667,height:375}]){
 const page=await browser.newPage({viewport,hasTouch:viewport.width<700}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://*.tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e3ecdf"/></svg>'}));
 await page.route('https://flora-api.bankofculture.com/**',r=>r.fulfill({contentType:'application/json',body:'{"plants":[],"total":0}'}));
 await page.goto(url);await page.getByText('護照已就緒',{exact:false}).waitFor();await cameraIdle(page);
 const read=()=>page.locator('#stage').evaluate(n=>({zoom:+n.dataset.cameraZoom,lat:+n.dataset.cameraLat,lng:+n.dataset.cameraLng,phase:n.dataset.cameraPhase,level:n.dataset.level}));
 const initial=await read();
 const choose=async(name='龍安里',district='大安區')=>{if(!await page.locator('#finder').isVisible())await page.locator('#finder-toggle').click();await page.locator('#search').fill(name);if(!await page.locator('#finder').isVisible())await page.locator('#finder-toggle').click();await page.locator('#villages button').filter({hasText:district+'・'+name}).click();};
 // Read-only animation observations: actual polygon/tile matrices and logical zoom every rAF.
 const sample=async(action,label)=>{
  await page.evaluate(()=>{window.__cameraSamples=[];let start=performance.now();const tick=()=>{const n=document.querySelector('#stage'),p=document.querySelector('path[data-village]'),t=document.querySelector('.leaflet-tile-container');window.__cameraSamples.push({t:performance.now()-start,z:+n.dataset.cameraZoom,phase:n.dataset.cameraPhase,poly:p?.getBoundingClientRect().toJSON(),tile:t?getComputedStyle(t).transform:''});if(performance.now()-start<650)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  await action();await page.waitForTimeout(700);await cameraIdle(page);
  const frames=await page.evaluate(()=>window.__cameraSamples);const moving=frames.filter(f=>f.phase==='moving'&&f.t<400);const distinct=new Set(moving.map(f=>f.z.toFixed(5)+'/'+f.tile+'/'+f.poly?.width.toFixed(3))).size;
  assert.ok(distinct>=3,label+' continuous intermediate rendered frames: '+distinct);report.push({viewport,label,distinct,frames});return frames;
 };
 await sample(()=>choose(),'village-fit');
 const fit=async()=>{await cameraIdle(page);const id=await page.locator('canvas[data-village-trees]').getAttribute('data-village-id'),poly=await page.locator('path[data-village="'+id+'"]').boundingBox(),bubble=await page.locator('.village-popup').boundingBox();assert.ok(poly.x>=-2&&poly.x+poly.width<=viewport.width+2);assert.ok(poly.y>=bubble.y+bubble.height-3&&poly.y+poly.height<=viewport.height-25);};await fit();
 await page.screenshot({path:out+'/'+viewport.width+'-village.png'});
 const z=(await read()).zoom;await sample(()=>page.locator('.leaflet-control-zoom-in').click(),'button');assert.ok(Math.abs((await read()).zoom-z-.5)<.001);
 await page.mouse.move(viewport.width*.55,viewport.height*.8);await sample(()=>page.mouse.wheel(0,30),'wheel');const wz=(await read()).zoom;assert.ok(Math.abs(wz-Math.round(wz))>.001,'fractional wheel zoom');
 // Actual drag changes focus; exiting keeps that focus, not the old overview.
 const x=viewport.width*.5,y=viewport.height*.83;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+35,y-20,{steps:8});await page.mouse.up();await page.waitForTimeout(400);await cameraIdle(page);const focused=await read();
 await sample(()=>page.locator('.village-popup .leaflet-popup-close-button').click(),'pullback');const after=await read();const pixelsPerDegree=256*2**after.zoom/360;assert.ok(Math.abs(after.lat-focused.lat)*pixelsPerDegree/Math.cos(after.lat*Math.PI/180)<1&&Math.abs(after.lng-focused.lng)*pixelsPerDegree<1,JSON.stringify({focused,after}));assert.ok(Math.abs(after.zoom-(focused.zoom-1.25))<.001);assert.ok(Math.abs(after.zoom-initial.zoom)>.1);assert.equal(await page.locator('#hover-preview').count(),0);
 // Immediate close and retarget do not install late completion callbacks.
 await choose();await page.keyboard.press('Escape');await cameraIdle(page);assert.equal((await read()).level,'overview');
 await choose();await page.locator('#finder-toggle').click();await page.locator('#search').fill('');await page.keyboard.press('Escape');const next=page.locator('path[aria-label^=大安區光信里]');await next.focus();await next.press('Enter');await cameraIdle(page);assert.match(await page.locator('.village-overview h2').innerText(),/光信里/);await fit();
 await choose();await page.locator('#finder-toggle').click();await page.locator('#reset').click();await page.keyboard.press('Escape');await cameraIdle(page);assert.equal((await read()).level,'overview');assert.ok(Math.abs((await read()).zoom-initial.zoom)<.001);
 // Live reduced preference, including in-flight change; no global animation freeze.
 await choose();await page.emulateMedia({reducedMotion:'reduce'});await cameraIdle(page);await fit();await page.locator('.village-popup .leaflet-popup-close-button').click();await cameraIdle(page);assert.equal((await read()).phase,'idle');
 await choose();assert.equal((await read()).phase,'idle');await fit();await page.emulateMedia({reducedMotion:'no-preference'});await sample(()=>page.locator('.village-popup .leaflet-popup-close-button').click(),'live-motion-restored');
 if(viewport.width===390){const cdp=await page.context().newCDPSession(page),cx=viewport.width*.5,cy=viewport.height*.78;const beforePinch=(await read()).zoom;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-30,y:cy},{x:cx+30,y:cy}]});for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-30-i*4,y:cy},{x:cx+30+i*4,y:cy}]});await page.waitForTimeout(20);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cameraIdle(page);assert.ok((await read()).zoom>beforePinch+.2,'real CDP two-finger pinch zooms');await cdp.detach();}assert.deepEqual(errors,[]);await page.screenshot({path:out+'/'+viewport.width+'-overview.png'});await page.close();
}await writeFile(out+'/frames.json',JSON.stringify(report));console.log(JSON.stringify({passed:true,url,cases:report.map(({viewport,label,distinct})=>({width:viewport.width,label,distinct})),errors:[]}));}finally{await browser.close();}
