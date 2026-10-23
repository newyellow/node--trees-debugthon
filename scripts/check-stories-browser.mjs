import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base = process.env.STORIES_TEST_URL || 'http://127.0.0.1:5182/stories/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir('test-results', { recursive: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    const response = await page.goto(base);
    assert.equal(response.status(), 200);
    await page.locator('h1').waitFor();
    assert.match(await page.title(), /樹木故事/);
    assert.equal(await page.locator('#first-story details').getAttribute('open'), null);
    await page.getByRole('link', { name: '試試兩個文化提問 ↓' }).click();
    await page.getByText('展開故事欄位', { exact: true }).click();
    assert.equal(await page.locator('#first-story details').evaluate(el => el.open), true);
    assert.equal(await page.locator('dt', { hasText: '資料來源' }).isVisible(), true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
    await page.screenshot({ path: `test-results/stories-${name}.png`, fullPage: true });
    await page.getByText('展開故事欄位', { exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#first-story details').evaluate(el => el.open), false);
    const map = page.getByRole('link', { name: '資料探索地圖 ↗', exact: true });
    const mapResponse = await page.request.get(await map.evaluate(el => el.href));
    assert.equal(mapResponse.status(), 200);
    console.log(`${name}: render, disclosure, keyboard, layout and map link passed`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
