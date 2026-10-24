import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalogue, csvCell, toCsv, toMarkdown } from '../scripts/tree-history-data.mjs';
const fixture=()=>({schemaVersion:1,updatedAt:'2026-10-24',description:'Test-only fixture',coverageNote:'Not a published historical claim',entries:[{id:'test-only',species:['測試標籤'],location:'測試地點',period:'未標示',title:'Test, title',summary:'Test summary',evidenceScope:'site-history',verificationStatus:'source-supported',limitations:'Test limitation',sources:[{title:'Test source',publisher:'Test publisher',url:'https://example.com/',publishedAt:null,accessedAt:'2026-10-24',locator:'Test paragraph',excerpt:'Test excerpt'}]}]});
test('research schema rejects missing evidence, duplicate ids and unsafe links',()=>{
  assert.equal(validateCatalogue(fixture()).entries.length,1);
  const absent=fixture(); absent.entries[0].sources=[]; assert.throws(()=>validateCatalogue(absent),/source/);
  const dup=fixture(); dup.entries.push(dup.entries[0]); assert.throws(()=>validateCatalogue(dup),/Duplicate/);
  const bad=fixture();bad.entries[0].sources[0].url='javascript:alert(1)';assert.throws(()=>validateCatalogue(bad),/Unsafe/);
});
test('CSV protects spreadsheet formula cells and quotes commas/newlines',()=>{
  assert.equal(csvCell('=1+1').charCodeAt(1),39);
  assert.equal(csvCell('  +1').charCodeAt(1),39);
  const lf=String.fromCharCode(10);
  assert.equal(csvCell('a,"b"'+lf+'c'),'"a,""b""'+lf+'c"');
  assert.ok(toCsv(fixture()).startsWith(String.fromCharCode(65279)));
  assert.ok(toCsv(fixture()).includes('Test, title'));
  assert.ok(toMarkdown(fixture()).includes('https://example.com/'));
});

import { readFile } from 'node:fs/promises';
test('published research catalogue and generated exports are complete and synchronized',async()=>{
  const root=new URL('../',import.meta.url);
  const data=validateCatalogue(JSON.parse(await readFile(new URL('public/data/tree-cultural-stories.json',root),'utf8')));
  assert.ok(data.entries.length>=1);
  for(const e of data.entries){assert.ok(!e.id.startsWith('test'));assert.ok(e.sources.every(s=>!new URL(s.url).hostname.startsWith('example.')));}
  assert.equal(await readFile(new URL('public/data/tree-cultural-stories.csv',root),'utf8'),toCsv(data));
  assert.equal(await readFile(new URL('docs/tree-cultural-stories.md',root),'utf8'),toMarkdown(data));
});
