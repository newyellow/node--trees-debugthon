import {cameraIdle} from './browser-test-helpers.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {treeSpecies} from '../src/workspaces/02/tree-species.js';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const base=new URL(process.env.TREES_PORTAL_URL||'http://127.0.0.1:61629/');
const data=await read('public/data/tree-cultural-stories.json'),media=await read('public/data/social-story-media.json'),manifest=await read('public/data/village-trees/manifest.json');
const samples=[];for(const entry of data.entries.filter(e=>e.images?.[0]?.provenance==='source-attributed'))if(!samples.some(s=>s.entry.species[0]===entry.species[0])&&samples.length<3){
 let found;for(const v of Object.values(manifest.villages).filter(v=>v.count>0).sort((a,b)=>a.count-b.count)){
  const records=(await read('public/data/village-trees/'+v.file)).records,index=records.findIndex(r=>treeSpecies(r.feature)===entry.species[0]);if(index>=0){found={entry,v,index};break;}
 }if(found)samples.push(found);
}
assert.ok(samples.length>=1,'At least one new source article photo must be tested in actual social game');
await mkdir('test-results/editorial-browser',{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://*.tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>'}));
 await page.goto(new URL('stories/research/index.html',base).href);await page.locator('#filters').waitFor({state:'visible'});assert.equal(await page.locator('#rows > tr').count(),54);
 for(const entry of data.entries){const row=page.locator('[data-story-id="'+entry.id+'"]');assert.equal(await row.locator('td[data-label="摘要"] > p').first().innerText(),entry.summary);if(entry.images?.length){const photo=row.locator('img');await photo.evaluate(i=>{i.loading='eager';});await photo.evaluate(i=>i.decode());assert.equal(await photo.evaluate(i=>i.naturalWidth),entry.images[0].width);assert.equal(await photo.getAttribute('src'),base.pathname+entry.images[0].path);assert.ok((await row.locator('figcaption').innerText()).includes(entry.images[0].credit));}}
 for(const image of new Map(data.entries.flatMap(e=>e.images??[]).map(i=>[i.path,i])).values()){const r=await page.request.get(new URL(image.path,base).href);assert.equal(r.status(),200);assert.equal(createHash('sha256').update(await r.body()).digest('hex'),image.sha256);}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('[data-story-id="'+samples[0].entry.id+'"]').screenshot({path:'test-results/editorial-browser/research-'+width+'.png'});
 for(const {entry,v,index}of samples){
  await page.goto(new URL('workspaces/02/index.html',base).href);await page.getByText('護照已就緒',{exact:false}).waitFor();await page.locator('#finder-toggle').click();await page.locator('#search').fill(v.name);await page.locator('#villages button').filter({hasText:v.district+'・'+v.name}).click();
  await page.waitForFunction(id=>{const c=document.querySelector('canvas[data-village-trees]');return c?.dataset.phase==='ready'&&c.dataset.villageId===id;},v.id);
  await cameraIdle(page);const canvas=page.locator('canvas[data-village-trees]');await canvas.focus();await canvas.evaluate((c,n)=>{for(let i=0;i<n;i++)c.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));},index);await cameraIdle(page);await page.keyboard.press('Enter');
  const article=page.locator('.species-stories [data-story-id="'+entry.id+'"]');await article.waitFor({timeout:8000}).catch(async error=>{console.log('STORY SELECTION DEBUG',JSON.stringify({id:entry.id,species:entry.species,village:v.id,index,canvas:await canvas.evaluate(c=>({...c.dataset})),panels:await page.locator('.species-stories').allTextContents()}));throw error;});assert.ok((await article.innerText()).includes(entry.summary));const photo=article.locator('img');await photo.waitFor();await photo.scrollIntoViewIfNeeded();await photo.evaluate(i=>i.decode());assert.equal(await photo.getAttribute('src'),base.pathname+entry.images[0].path);assert.ok((await article.locator('figcaption').innerText()).includes(entry.images[0].credit));
  await article.screenshot({path:'test-results/editorial-browser/social-'+entry.id+'-'+width+'.png'});
 }
 assert.deepEqual(errors,[]);await page.close();console.log('PASS '+width+'px '+base.pathname+':54 exact rewritten summaries, all stored photos decoded/hash-matched, '+samples.length+' real game species story/photo samples, source captions and no page errors');
}}finally{await browser.close();}
