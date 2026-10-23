import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  window.__analysisRequests = [];
  const original = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function(data, ...rest) {
    if (data.type === 'analyze') window.__analysisRequests.push(data.indices.slice());
    return original.call(this, data, ...rest);
  };
});
const stats = () => page.locator('#map').evaluate(el => Object.fromEntries(Object.entries(el.dataset).filter(([k]) => k.startsWith('render')).map(([k,v]) => [k,Number(v)])));
async function pan(label) {
  const before = await stats(), box = await page.locator('#map').boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height * .45;
  await page.mouse.move(x,y); await page.mouse.down();
  for(let step=1;step<=8;step++){await page.mouse.move(x+step*9,y);await page.waitForTimeout(30);}
  await page.mouse.up();
  await page.waitForFunction(frame => Number(document.querySelector('#map').dataset.renderFrame)>frame,before.renderFrame);
  if(label==='sidewalk')await page.waitForFunction(()=>document.querySelector('#analysis-status').textContent.includes('段已分析'));
  await page.waitForTimeout(350);
  const after=await stats();
  assert.ok(after.renderReused>0,`${label}: surviving layers should be reused`);
  assert.ok(after.renderAdded<after.renderTotal,`${label}: whole scene was recreated`);
  assert.ok(after.renderRemoved<before.renderTotal,`${label}: whole scene was removed`);
  console.log(`${label}: ${after.renderReused} reused, ${after.renderAdded} added, ${after.renderRemoved} removed`);
  return after;
}
try {
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>document.querySelector('#map-notice').textContent.includes('全覽模式'));
  await page.locator('.cluster-wrap').evaluateAll(markers=>markers.forEach((m,i)=>{m.dataset.qaIdentity=String(i);}));
  await pan('points');
  assert.ok(await page.locator('.cluster-wrap[data-qa-identity]').count()>0,'cluster DOM nodes must survive the pan');
  await page.locator('#density-mode').click();
  await page.waitForFunction(()=>document.querySelector('#map').dataset.renderTotal>0&&document.querySelector('#density-legend').dataset.cells>0);
  await page.waitForTimeout(200);
  await pan('grid');
  const opacityBefore=await stats();
  await page.locator('#heat-opacity').fill('0.4');
  await page.waitForFunction(frame=>Number(document.querySelector('#map').dataset.renderFrame)>frame,opacityBefore.renderFrame);
  const opacityAfter=await stats();
  assert.equal(opacityAfter.renderAdded,0); assert.equal(opacityAfter.renderRemoved,0); assert.ok(opacityAfter.renderStyled>0);
  for(const shape of ['district','village']){
    await page.selectOption('#analysis-shape',shape);
    await page.waitForFunction(()=>document.querySelector('#analysis-status').textContent.includes('456 里／12 區'));
    await pan(shape);
  }
  await page.locator('#reset-map').click();
  await page.waitForFunction(()=>document.querySelector('#zoom-label').textContent==='ZOOM 13');
  await page.waitForTimeout(350);
  for(let z=14;z<=16;z++){
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForTimeout(400);
    await page.waitForFunction(zoom=>document.querySelector('#zoom-label').textContent===`ZOOM ${zoom}`,z);
  }
  await page.selectOption('#analysis-shape','sidewalk');
  await page.waitForFunction(()=>document.querySelector('#analysis-status').textContent.includes('段已分析'),null,{timeout:60000});
  const requestsBefore=await page.evaluate(()=>window.__analysisRequests.length);
  const sidewalk=await pan('sidewalk');
  const delta=await page.evaluate(n=>window.__analysisRequests.slice(n).flat(),requestsBefore);
  assert.ok(delta.length<sidewalk.renderTotal,'only newly encountered sidewalks should be sent to the worker');
  const requestsAfter=await page.evaluate(()=>window.__analysisRequests.length), frame=(await stats()).renderFrame;
  await page.locator('#heat-opacity').fill('0.7');
  await page.waitForFunction(f=>Number(document.querySelector('#map').dataset.renderFrame)>f,frame);
  assert.equal(await page.evaluate(()=>window.__analysisRequests.length),requestsAfter,'opacity must not trigger analysis');
  assert.equal((await stats()).renderAdded,0); assert.equal((await stats()).renderRemoved,0);
  console.log(`sidewalk worker: only ${delta.length} new indices sent for ${sidewalk.renderTotal} visible sidewalks`);
  assert.deepEqual(errors,[]);
  console.log('PASS: five modes preserve layer identity, viewport updates are incremental, opacity only restyles, and worker only receives uncached sidewalks.');
} catch(error) {
  console.log('Diagnostic:',await page.locator('#zoom-label').textContent(),await page.locator('#map-notice').textContent());
  throw error;
} finally { await browser.close(); }
