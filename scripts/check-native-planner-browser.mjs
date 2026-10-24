import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results/planner',{recursive:true});
const url=process.env.NATIVE_PLANNER_URL||'http://127.0.0.1:5193/workspaces/03/index.html';
const real=process.argv.includes('--real');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const requests=[],errors=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('pageerror',e=>errors.push(e.message));
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
if(!real)await page.route(/\.(png|jpg|jpeg)(\?.*)?$/i,r=>r.fulfill({contentType:'image/png',body:pixel}));
const plant={id:'963ec644-2763-494c-ab4f-7649c5a73f6c',scientific_name:'Acer serrulatum',vernacular_name_zh:'青楓',family:'Sapindaceae',plant_form:'tree',sun_exposure:'全日照',water_needs:null,elevation_min:250,elevation_max:2210,image_license:'unknown',description:'SECRET_UNLICENSED_TEXT',data_source:'TaiCOL + inat_alt'};
let fail=false,empty=false;
if(!real)await page.route('https://flora-api.bankofculture.com/api/v1/plants/**',async r=>{if(fail){fail=false;return r.fulfill({status:503,body:'failed'});}const u=new URL(r.request().url());await r.fulfill({contentType:'application/json',body:JSON.stringify(u.pathname.endsWith('/recommend')?(empty?[]:[plant]):u.pathname.endsWith(plant.id)?plant:{plants:[plant],total:1})});});
try{
await page.goto(url);await page.waitForSelector('#search-button');
assert.equal(requests.some(r=>r.url.includes('/api/v1/')),false,'no eager API');
await page.selectOption('#district','文山區');await page.selectOption('#habitat','景美溪');assert.match(await page.locator('#policy').innerText(),/景美溪.*使用者指定/);
await page.click('#load-map');await page.waitForFunction(()=>document.querySelector('#map-status').textContent.includes('已載入'));await page.locator('#map').click({position:{x:350,y:380}});assert.match(await page.locator('#location').innerText(),/\d+\.\d+/);
await page.selectOption('[name=sun_exposure]','full_sun');await page.selectOption('[name=water_needs]','low');await page.fill('[name=elevation]',real?'300':'0');await page.fill('#search','Acer serrulatum');await page.click('#search-button');await page.waitForSelector('#results .plant');assert.match(await page.locator('#results').innerText(),/水分/);assert.equal((await page.locator('body').innerText()).includes('SECRET_UNLICENSED_TEXT'),false);
await page.locator('#results button').filter({hasText:'加入配植草稿'}).first().click();assert.match(await page.locator('#shortlist').innerText(),/青楓/);await page.locator('#shortlist button').first().click();assert.equal(await page.locator('#shortlist .mix-item').count(),0);
await page.locator('#results button').filter({hasText:'查看事實欄位'}).first().click();await page.waitForSelector('#detail .plant');
await page.screenshot({path:'test-results/planner/'+(real?'real':'mock')+'-desktop.png'});const actualImages=await page.locator('#detail img').evaluateAll(xs=>xs.map(x=>({src:x.src,loaded:x.complete&&x.naturalWidth>0})));console.log(JSON.stringify({actualImages}));
const before=requests.filter(r=>r.url.includes('/api/v1/')).length;await page.setInputFiles('#photo',{name:'local.png',mimeType:'image/png',buffer:pixel});await page.waitForFunction(()=>document.querySelector('#photo-preview').src.startsWith('blob:'));assert.equal(requests.filter(r=>r.url.includes('/api/v1/')).length,before);await page.click('#clear-photo');assert.equal(await page.locator('#photo-preview').getAttribute('src'),null);
if(real){await page.fill('[name=elevation]','0');await page.click('#search-button');await page.waitForFunction(()=>document.querySelector('#api-status').textContent.includes('零筆'));await page.click('#recommend');await page.waitForFunction(()=>document.querySelector('#api-status').textContent.includes('已收到')||document.querySelector('#api-status').textContent.includes('零筆'));const apiURLs=requests.filter(r=>r.url.includes('/api/v1/plants/')).map(r=>new URL(r.url));assert.ok(apiURLs.some(u=>u.searchParams.get('elevation')==='0'));assert.ok(apiURLs.some(u=>u.pathname.endsWith('/recommend')));for(const u of apiURLs){assert.equal(u.searchParams.has('sun_exposure'),false);assert.equal(u.searchParams.has('water_needs'),false);}}
if(!real){empty=true;await page.click('#recommend');await page.waitForFunction(()=>document.querySelector('#api-status').textContent.includes('零筆'));fail=true;await page.fill('#search','retry');await page.click('#search-button');await page.waitForSelector('#retry:visible');await page.click('#retry');await page.waitForSelector('#results .plant');}
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'test-results/planner/'+(real?'real':'mock')+'-mobile.png'});await page.locator('#reset-all').scrollIntoViewIfNeeded();await page.click('#reset-all');assert.equal(await page.locator('#results .plant').count(),0);
const isAmbient=r=>{const u=new URL(r.url);return u.origin===new URL(url).origin&&u.pathname==='/cdn-cgi/rum';};const ambientAnalytics=requests.filter(r=>r.method!=='GET'&&isAmbient(r));console.log(JSON.stringify({ambientAnalytics}));assert.equal(requests.some(r=>r.method!=='GET'&&!isAmbient(r)),false,'planner/API GET only; existing CDN analytics reported separately');assert.equal(requests.some(r=>/trees\.json|park-trees|street-trees|ai\/analyze/.test(r.url)),false);assert.deepEqual(errors,[]);
console.log(JSON.stringify({mode:real?'real-browser-api-get':'deterministic-mock',passed:true,apiRequests:requests.filter(r=>r.url.includes('/api/v1/'))},null,2));
}finally{await browser.close();}
