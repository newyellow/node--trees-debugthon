// One isolated functional gate, no Vite/server process and no live model/network.
import {chromium} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1200,height:850}});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin!=='http://advice.test')throw Error('Unexpected external request '+u.href);
  const path=u.pathname==='/'?'/tests/fixtures/advice-panel.html':u.pathname;
  if(!path.startsWith('/src/')&&!path.startsWith('/tests/fixtures/'))throw Error('Unexpected path '+path);
  const body=await readFile(new URL('..'+path,import.meta.url));
  await route.fulfill({body,contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'});
 });
 await page.goto('http://advice.test/');await page.waitForFunction(()=>window.ready);
 await page.evaluate(()=>window.openPanel());
 await page.waitForFunction(()=>window.vision===1);
 assert.equal(await page.locator('.advice-turn--assistant').count(),1);
 assert.equal(await page.evaluate(()=>window.calls[0].url),'http://advice.test/api/plant-advice');
 assert.equal(await page.evaluate(()=>window.calls[0].body.villageId),'v1');
 await page.locator('textarea').fill('再問一次');await page.getByRole('button',{name:'傳送',exact:true}).click();
 await page.waitForFunction(()=>window.calls.length===2&&!document.querySelector('[aria-busy="true"]'));
 assert.equal(await page.evaluate(()=>window.vision),1);
 assert.equal(await page.evaluate(()=>window.calls[1].body.history.length),2);
 await page.evaluate(()=>window.queue.push({data:{answer:'',plants:[],sources:[]}}));
 await page.locator('textarea').fill('失敗測試');await page.getByRole('button',{name:'傳送',exact:true}).click();
 await page.getByRole('button',{name:'手動重試',exact:true}).waitFor();
 assert.equal(await page.locator('.advice-turn--assistant').count(),2);
 await page.getByRole('button',{name:'手動重試',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.advice-turn--assistant').length===3);
 assert.equal(await page.locator('.advice-turn--user').count(),3);
 await page.evaluate(()=>{window.queue.push('hold');window.openPanel('planting');});
 const held=await page.evaluate(()=>window.calls.length-1);
 await page.evaluate(()=>window.openPanel('home','v2'));
 await page.waitForFunction(()=>document.querySelectorAll('.advice-turn--assistant').length===1);
 assert.equal(await page.evaluate(i=>window.calls[i].signal.aborted,held),true);
 await page.evaluate(()=>window.pending.shift()({ok:true,json:async()=>({answer:'STALE',plants:[],sources:[],tour:{kind:'four-region-vision'}})}));
 assert.equal(await page.locator('.advice-log').innerText().then(t=>t.includes('STALE')),false);
 assert.equal(await page.evaluate(()=>window.vision),1);
 assert.match(await page.locator('h2').innerText(),/另一里.*居家/);
 await page.evaluate(()=>{window.queue.push('hold');window.openPanel('home');});
 await page.getByRole('button',{name:'取消產生',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.calls.at(-1).signal.aborted),true);
 await page.getByRole('button',{name:'關閉 AI 建議',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.panel.isOpen()),false);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'trigger');
 console.log('PASS isolated mock functional gate: initial + followup/history, retry, stale mode switch, home no tour, cancel, close/focus. No live requests.');
}finally{await browser.close();}