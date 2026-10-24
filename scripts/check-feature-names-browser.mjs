import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const root=process.env.TREES_PORTAL_URL||'http://127.0.0.1:5173/';
const names=[['城市植群圖譜','explorer/index.html'],['植物文化地層','stories/index.html'],['鄰里共生實驗','workspaces/02/index.html'],['未來植群編織','workspaces/03/index.html']];
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const width of [1440,390]){const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(root).origin?r.continue():r.abort());
 await page.goto(root);await page.locator('.entry').last().waitFor();assert.deepEqual(await page.locator('.entry h3').allTextContents(),names.map(x=>x[0]));
 for(const [name,path]of names){await page.goto(root);const link=page.getByRole('link',{name:'進入'+name,exact:true});assert.equal(await link.getAttribute('href'),new URL(path,root).pathname);await link.click();await page.waitForURL(new URL(path,root).href);assert.ok((await page.title()).includes(name));await page.reload();assert.ok((await page.title()).includes(name));assert.ok((await page.locator('body').innerText()).includes(name));}
 await page.goto(new URL('stories/research/index.html',root).href);await page.getByRole('link',{name:'返回植物文化地層',exact:true}).click();await page.waitForURL(new URL('stories/index.html',root).href);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,width,names:4,explicitURLs:true,reload:true,researchBacklink:true,errors}));await page.close();}}finally{await browser.close();}
