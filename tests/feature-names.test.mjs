import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sites} from '../src/shared/sites.js';
const expected=[['城市植群圖譜','explorer/index.html'],['植物文化地層','stories/index.html'],['鄰里共生實驗','workspaces/02/index.html'],['未來植群編織','workspaces/03/index.html']];
test('feature names match authorized labels and preserve explicit entry URLs',async()=>{
 assert.deepEqual(sites.map(({label,path})=>[label,path]),expected);
 const home=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const [label,path]of expected){const html=await readFile(new URL('../'+path,import.meta.url),'utf8');assert.match(html,new RegExp('<title>[^<]*'+label));assert.ok(home.includes(label));assert.ok(home.includes('%BASE_URL%'+path));}
 const research=await readFile(new URL('../stories/research/index.html',import.meta.url),'utf8');assert.ok(research.includes('返回植物文化地層'));
});
