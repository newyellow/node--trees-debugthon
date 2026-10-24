import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('real story database owns cultural-strata identity and links only to real neighbor/home',()=>{
 const html=read('stories/research/index.html');
 assert.match(html,/<title>植物文化地層｜故事資料庫<\/title>/);
 assert.match(html,/<h1>植物文化地層<\/h1>/);assert.match(html,/<p class="subtitle">故事資料庫<\/p>/);
 assert.ok(html.includes('%BASE_URL%index.html'));assert.ok(html.includes('%BASE_URL%workspaces/02/index.html'));
 assert.ok(!html.includes('%BASE_URL%stories/index.html'));
 for(const id of ['filters','species','location','query','status','results','rows','retry'])assert.ok(html.includes('id="'+id+'"'));
});
test('research palette retains responsive cards, readable photo-first stories and square vocabulary',()=>{
 const css=read('src/stories/research.css');
 for(const color of ['#95865e','#014f35','#3e7046','#97ca46','#a0c69f'])assert.ok(css.includes(color));
 assert.ok(!css.includes('Georgia'));assert.ok(css.includes('font-weight:900'));assert.ok(css.includes('border-radius:0'));
 assert.ok(css.includes('@media(max-width:700px)'));assert.ok(css.includes('.story-summary,.story-text p'));assert.ok(css.includes('max-width:720px'));
 assert.ok(css.includes('[hidden]{display:none!important}'));assert.ok(css.includes(':focus-visible'));
});
