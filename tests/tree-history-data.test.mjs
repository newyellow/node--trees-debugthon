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
  for(const e of data.entries){assert.ok(!e.id.startsWith('test'));assert.ok(e.sources.every(s=>s.kind==='provided-document' || !new URL(s.url).hostname.startsWith('example.')));}
  assert.equal(await readFile(new URL('public/data/tree-cultural-stories.csv',root),'utf8'),toCsv(data));
  assert.equal(await readFile(new URL('docs/tree-cultural-stories.md',root),'utf8'),toMarkdown(data));
});

test('provided PDF citations retain printed/PDF pages without invented web URLs',()=>{
  const data=fixture(); data.entries[0].verificationStatus='lead';
  data.entries[0].sources[0]={...data.entries[0].sources[0],kind:'provided-document',url:null,documentId:'report-p21',documentPath:'docs/research/provided-report/source-page-21.pdf',page:21,pdfPage:1};
  assert.equal(validateCatalogue(data).entries.length,1);
  assert.match(toCsv(data),/印刷頁21／PDF頁1/);
  assert.match(toMarkdown(data),/使用者提供PDF/);
  assert.ok(!toMarkdown(data).includes('](null)'));
  for(const documentPath of ['../../secret.pdf','/private/secret.pdf','docs/research/../secret.pdf','javascript:alert(1)']){
    const bad=structuredClone(data);bad.entries[0].sources[0].documentPath=documentPath;
    assert.throws(()=>validateCatalogue(bad),/Invalid provided/);
  }
  const bad=structuredClone(data);bad.entries[0].sources[0].page=0;assert.throws(()=>validateCatalogue(bad),/Invalid provided/);
  const missing=structuredClone(data);delete missing.entries[0].sources[0].kind;assert.throws(()=>validateCatalogue(missing),/Unsafe/);
});
