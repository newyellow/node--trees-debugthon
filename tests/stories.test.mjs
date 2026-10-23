import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../stories/index.html', import.meta.url), 'utf8');
test('story prototype labels unpublished content and source placeholders', () => {
  for (const text of ['尚無正式發布的故事', '版型示範 · 非真實事件', '資料來源', '照片與授權', '目前沒有投稿或儲存功能']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('<form'));
});
test('story page has accessible native disclosure and base-aware navigation', () => {
  for (const text of ['lang="zh-Hant"', 'href="#main"', '<details><summary>展開故事欄位</summary>', 'href="%BASE_URL%explorer/index.html"', 'id="first-story"']) assert.ok(html.includes(text), text);
});
