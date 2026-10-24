import {cameraIdle} from './browser-test-helpers.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {treeSpecies} from '../src/workspaces/02/tree-species.js';
const base=new URL(process.env.TREES_PORTAL_URL||'http://127.0.0.1:61627/');
const catalogue=JSON.parse(await readFile(new URL('../public/data/tree-cultural-stories.json',import.meta.url)));
const e=catalogue.entries.find(e=>e.id==='royal-palm-southern-imagination');
const manifest=JSON.parse(await readFile(new URL('../public/data/village-trees/manifest.json',import.meta.url)));
let chosen,records;
for(const v of Object.values(manifest.villages).filter(v=>v.count>0).sort((a,b)=>a.count-b.count)){const rs=JSON.parse(await readFile(new URL('../public/data/village-trees/'+v.file,import.meta.url))).records;if(rs.some(r=>treeSpecies(r.feature)==='大王椰子')){chosen=v;records=rs;break;}}
assert.ok(chosen);await mkdir('test-results/palm',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const width of [1440,390]){
 const p=await browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',x=>errors.push(x.message));
 await p.route('https://*.tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>'}));
 await p.goto(new URL('stories/research/index.html',base).href);await p.locator('#filters').waitFor({state:'visible'});
 await p.getByLabel('樹種',{exact:true}).fill('大王椰子');const row=p.locator('[data-story-id="'+e.id+'"]');await row.waitFor();
 const image=row.locator('img');await image.scrollIntoViewIfNeeded();await image.evaluate(i=>i.decode());assert.equal(await image.evaluate(i=>i.naturalWidth),600);
 assert.equal(await image.getAttribute('src'),base.pathname+e.images[0].path);assert.match(await row.locator('figcaption').innerText(),/空中小姐/);
 await row.getByText('閱讀完整故事',{exact:true}).click();await row.locator('.story-text[open]').waitFor();assert.match(await row.locator('.story-text').innerText(),/理想城市/);
 const response=await p.request.get(new URL(e.images[0].path,base).href);assert.equal(response.status(),200);assert.equal(createHash('sha256').update(await response.body()).digest('hex'),e.images[0].sha256);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await row.screenshot({path:'test-results/palm/research-'+width+'.png'});
 await p.goto(new URL('workspaces/02/index.html',base).href);await p.getByText('護照已就緒',{exact:false}).waitFor();
 await p.locator('#finder-toggle').click();await p.locator('#search').fill(chosen.name);await p.locator('#villages button').filter({hasText:chosen.district+'・'+chosen.name}).click();
 await p.waitForFunction(id=>{const c=document.querySelector('canvas[data-village-trees]');return c?.dataset.phase==='ready'&&c.dataset.villageId===id;},chosen.id);
 await cameraIdle(p);const canvas=p.locator('canvas[data-village-trees]'),index=records.findIndex(r=>treeSpecies(r.feature)==='大王椰子');await canvas.focus();await canvas.evaluate((c,n)=>{for(let i=0;i<n;i++)c.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));},index);await cameraIdle(p);await p.keyboard.press('Enter');
 const article=p.locator('.species-stories [data-story-id="'+e.id+'"]');await article.waitFor();const photo=article.locator('img');await photo.waitFor();await photo.scrollIntoViewIfNeeded();await photo.evaluate(i=>i.decode());assert.equal(await photo.evaluate(i=>i.naturalWidth),600);assert.equal(await photo.getAttribute('src'),base.pathname+e.images[0].path);
 await article.getByText('閱讀完整故事',{exact:true}).click();await article.locator('details[open]').waitFor();assert.match(await article.innerText(),/南方/);await photo.scrollIntoViewIfNeeded();await p.screenshot({path:'test-results/palm/social-'+width+'.png'});
 assert.deepEqual(errors,[]);await p.close();console.log('PASS royal palm '+width+'px '+base.pathname+': exact species match, full story, local supplied photo decoded in research + real social panel, exact JPEG SHA, caption and source');
}}finally{await browser.close();}
