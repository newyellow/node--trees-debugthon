import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {treeSpecies} from '../src/workspaces/02/tree-species.js';
const url=process.env.VILLAGE_GAME_URL||'http://127.0.0.1:5205/workspaces/02/index.html';
const manifest=JSON.parse(await readFile(new URL('../public/data/village-trees/manifest.json',import.meta.url)));
let chosen,records;
for(const entry of Object.values(manifest.villages).filter(v=>v.count>0).sort((a,b)=>a.count-b.count)){
 const rs=JSON.parse(await readFile(new URL('../public/data/village-trees/'+entry.file,import.meta.url))).records;
 if(['榕樹','樟樹'].every(name=>rs.some(r=>treeSpecies(r.feature)===name))){chosen=entry;records=rs;break;}
}
assert.ok(chosen);const out=new URL('../test-results/social-media-e2e/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const page=await browser.newPage({viewport}),errors=[],api=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().startsWith('https://flora-api.bankofculture.com/'))api.push(r.url());});
 await page.route('https://*.tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e3ecdf"/></svg>'}));
 await page.goto(url);await page.getByText('護照已就緒',{exact:false}).waitFor();assert.equal(api.length,0);
 await page.locator('#finder-toggle').click();await page.locator('#search').fill(chosen.name);await page.locator('#villages button').filter({hasText:chosen.district+'・'+chosen.name}).click();
 await page.waitForFunction(id=>{const c=document.querySelector('canvas[data-village-trees]');return c?.dataset.phase==='ready'&&c.dataset.villageId===id;},chosen.id);
 assert.equal(await page.locator('.village-overview .radar-axis-index').count(),6);assert.match(await page.locator('.rating-note').innerText(),/含模擬/);
 const canvas=page.locator('canvas[data-village-trees]');let position=0;
 for(const name of ['榕樹','樟樹']){
  const index=records.findIndex(r=>treeSpecies(r.feature)===name),steps=(index-position+records.length)%records.length;await canvas.focus();
  await canvas.evaluate((c,steps)=>{for(let i=0;i<steps;i++)c.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));},steps);position=index;await page.keyboard.press('Enter');
  await page.waitForFunction(()=>!!document.querySelector('.species-flora article')||document.querySelector('.species-flora')?.textContent.includes('手動重試'));
  assert.ok(await page.locator('.species-flora article').count(),await page.locator('.species-flora').innerText());
  assert.equal(await page.locator('.species-flora details').first().evaluate(n=>n.open),false);
  if(name==='榕樹'){
   const img=page.locator('.species-flora img').first();await img.scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const i=document.querySelector('.species-flora img');return i?.complete&&i.naturalWidth>0;});await img.evaluate(i=>i.decode());
   assert.equal(await img.getAttribute('referrerpolicy'),'no-referrer');assert.equal(await page.locator('.species-flora article').first().evaluate(n=>n.firstElementChild.tagName),'FIGURE');
  }else{
   await page.waitForFunction(()=>document.querySelector('.species-stories')?.dataset.phase==='ready');
   const story=page.locator('[data-story-id="inst-zhongshan-diplomatic-avenue"]');await story.waitFor();const img=story.locator('img');await img.waitFor();await img.evaluate(n=>n.loading='eager');await img.scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const i=document.querySelector('[data-story-id="inst-zhongshan-diplomatic-avenue"] img');return i?.complete&&i.naturalWidth>0;});await img.evaluate(i=>i.decode());
   assert.match(await story.locator('figcaption').innerText(),/臺北市政府/);assert.ok(await page.locator('[data-story-group]').evaluateAll(ns=>ns.every(n=>n.querySelector('article'))));
  }
  await page.screenshot({path:new URL(viewport.width+'-'+name+'.png',out).pathname});await page.keyboard.press('Escape');assert.equal(await page.locator('#stage').getAttribute('data-level'),'village');
 }
 assert.equal(api.length,2);await page.keyboard.press('Escape');assert.equal(await page.locator('#stage').getAttribute('data-level'),'overview');assert.deepEqual(errors,[]);await page.close();
}console.log(JSON.stringify({passed:true,url,village:chosen.id,viewports:2,realFlora:true,realStoryImage:true,sixAxes:true,errors:[]}));}finally{await browser.close();}
