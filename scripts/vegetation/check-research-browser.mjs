import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.TREES_ROOT_URL||'http://127.0.0.1:5173/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  const page=await browser.newPage({viewport}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.tile.openstreetmap.org/**',r=>r.abort());
  await page.goto(new URL('explorer/index.html',base).href);
  const link=page.getByRole('link',{name:'演算法研究、漏判限制與驗證進度 ↗'});
  await link.click();
  await page.getByRole('heading',{name:'先驗證演算法，再擴大分析',exact:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,new URL('explorer/algorithm-review.html',base).pathname);
  assert.equal(await page.locator('img,canvas,video').count(),0,'no raw imagery published');
  assert.ok((await page.locator('main').innerText()).includes('實際精度與最佳參數均未知'));
  assert.ok(await page.locator('main a[href^="https://"]').count()>=9);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.reload();await page.getByRole('heading',{name:'先驗證演算法，再擴大分析',exact:true}).waitFor();
  await page.getByRole('link',{name:'← 返回資料探索'}).click();
  await page.locator('#vegetation-controls').waitFor();
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log(JSON.stringify({passed:true,base,viewports:2,rawImageryPublished:false}));
}finally{await browser.close();}
