import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await mkdir('test-results', { recursive: true });
async function clickCoordinate(coordinate) {
  const point = await page.locator('.leaflet-tile-loaded').first().evaluate((tile, [lng, lat]) => {
    const [z,x,y] = new URL(tile.src).pathname.split('/').slice(1).map(v=>parseInt(v));
    const scale = 256 * 2 ** z, sin = Math.sin(lat*Math.PI/180), r = tile.getBoundingClientRect();
    return { x:r.x+((lng+180)/360*scale-x*256)*r.width/256, y:r.y+((.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale-y*256)*r.height/256 };
  }, coordinate);
  await page.mouse.click(point.x,point.y);
}
const data = JSON.parse(await readFile(new URL('../public/data/regions.json', import.meta.url)));
const street = JSON.parse(await readFile(new URL('../public/data/street-trees.geojson', import.meta.url)));
const targetIndex = data.membership['street-trees'].findIndex(i => i >= 0 && data.features[i].properties.district === '大安區');
const target = street.features[targetIndex].geometry.coordinates;
try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil:'domcontentloaded' });
  await page.waitForFunction(()=>document.querySelector('#map-notice').textContent.includes('全覽模式'));
  await page.locator('#density-mode').click();
  await page.selectOption('#analysis-shape','district');
  await page.waitForFunction(()=>document.querySelector('#analysis-status').textContent.includes('456 里／12 區'));
  await page.selectOption('#district','大安區');
  await page.locator('#fit-data').click();
  await page.waitForFunction(()=>document.querySelector('#cell-area').textContent.includes('1 個範圍'));
  await page.waitForTimeout(500);
  await clickCoordinate(target);
  await page.locator('.admin-popup').last().waitFor();
  assert.ok((await page.locator('.admin-popup').last().textContent()).includes('大安區'));
  assert.ok((await page.locator('.admin-popup').last().textContent()).includes('12,9') || (await page.locator('.admin-popup').last().textContent()).includes('12,8'));
  await page.keyboard.press('Escape');
  await page.screenshot({path:'test-results/district.png'});
  await page.selectOption('#analysis-shape','village');
  await page.waitForFunction(()=>document.querySelector('#cell-area').textContent.includes('依里'));
  await clickCoordinate(target);
  await page.locator('.admin-popup').last().waitFor();
  assert.ok((await page.locator('.admin-popup h3').last().textContent()).includes('里'));
  await page.keyboard.press('Escape');
  await page.screenshot({path:'test-results/village.png'});
  await page.getByRole('checkbox',{name:'顯示公園樹木',exact:true}).check();
  await page.waitForFunction(()=>!document.querySelector('#layers').textContent.includes('載入中'));
  await page.selectOption('#analysis-shape','sidewalk');
  await page.locator('#zoom-sidewalk').click();
  await page.waitForFunction(()=>document.querySelector('#analysis-status').textContent.includes('段已分析'),null,{timeout:60000});
  assert.equal(await page.locator('#summary-unit').textContent(),'段人行道');
  assert.ok(Number((await page.locator('#visible-count').textContent()).replaceAll(',',''))>0);
  const sidewalks=JSON.parse(await readFile(new URL('../public/data/sidewalks.geojson',import.meta.url)));
  // Search a known road, fit its complete geometry, then zoom to a specific segment.
  const walk=sidewalks.features.find(f=>f.properties._district==='大安區' && f.properties.NAME_Road && Number(f.properties.SW_LENG_ItemValue)>30);
  await page.locator('#search').fill(walk.properties.NAME_Road);
  await page.locator('#search').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#analysis-status').textContent.includes('段已分析'));
  await page.waitForTimeout(500);
  await page.screenshot({path:'test-results/sidewalk.png'});
  const polygon = walk.geometry.type === 'Polygon' ? walk.geometry.coordinates : walk.geometry.coordinates[0];
  await clickCoordinate(polygon[0][0]);
  await page.locator('.sidewalk-popup').waitFor();
  assert.ok((await page.locator('.sidewalk-popup').textContent()).includes('輪廓鄰近率'));
  await page.keyboard.press('Escape');
  await page.selectOption('#tree-radius','20');
  await page.selectOption('#tree-target','5');
  await page.selectOption('#coverage-target','0.5');
  await page.waitForFunction(()=>document.querySelector('#cell-area').textContent.includes('距離 20 m')&&document.querySelector('#cell-area').textContent.includes('5 筆／100 m'));
  await page.setViewportSize({width:390,height:844});
  await page.locator('#search').fill('');
  await page.locator('#search').press('Enter');
  await page.locator('#zoom-sidewalk').click();
  await page.waitForFunction(()=>document.querySelector('#analysis-status').textContent.includes('段已分析'));
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'test-results/analysis-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#reset-map').click();
  while (await page.locator('.leaflet-control-zoom-out').getAttribute('aria-disabled') !== 'true') {
    await page.locator('.leaflet-control-zoom-out').click();
    await page.waitForTimeout(300);
  }
  await page.waitForFunction(()=>document.querySelector('#zoom-label').textContent==='ZOOM 10');
  await page.waitForFunction(()=>document.querySelector('#analysis-status').textContent.includes('15053 段已分析'),null,{timeout:60000});
  assert.equal(await page.locator('#visible-count').textContent(),'15,053');
  await page.screenshot({path:'test-results/sidewalk-city-overview.png'});
  await page.selectOption('#analysis-shape','district');
  await page.waitForFunction(()=>document.querySelector('#cell-area').textContent.includes('12 個範圍'));
  assert.equal(await page.locator('#zoom-label').textContent(),'ZOOM 10');
  await page.selectOption('#analysis-shape','village');
  await page.waitForFunction(()=>document.querySelector('#cell-area').textContent.includes('456 個範圍'));
  assert.equal(await page.locator('#zoom-label').textContent(),'ZOOM 10');
  console.log('PASS: zoom 10 shows all 15,053 sidewalks, 12 districts, and 456 villages.');
  await page.locator('#point-mode').click();
  await page.waitForFunction(()=>document.querySelector('#point-mode').getAttribute('aria-pressed')==='true'&&document.querySelector('#summary-unit').textContent==='筆資料');
  assert.equal(await page.locator('#summary-unit').textContent(),'筆資料');
  assert.deepEqual(errors,[]);
  console.log('PASS: actual district/village geometry popups, spatial counts, lazy geometry, sidewalk worker, configurable targets, road search, mobile layout, mode restoration.');
} finally { await browser.close(); }
