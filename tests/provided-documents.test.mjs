import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateResearchData} from '../src/stories/research-model.js';
const root=new URL('../',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
test('integrated catalogue keeps PDF leads separate and validates in browser model',async()=>{
 const d=validateResearchData(await json('public/data/tree-cultural-stories.json'));
 assert.equal(d.entries.length,55);assert.equal(d.entries.filter(e=>e.verificationStatus==='lead').length,17);
 assert.equal(d.entries.filter(e=>e.verificationStatus==='source-supported').length,38);
 for(const e of d.entries.filter(e=>e.id.startsWith('yuanshan-')))assert.equal(e.verificationStatus,'lead');
 for(const e of d.entries)for(const s of e.sources.filter(s=>s.kind==='provided-document')){assert.equal(s.url,null);const body=await readFile(new URL('docs/research/provided-yuanshan-20261024/extracted-page-'+s.page+'.txt',root),'utf8');assert.ok(body.replace(/\s+/gu,'').includes(s.excerpt.replace(/\s+/gu,'')));}
});
test('six uploaded PDFs resolve to four pinned repo documents without public PDF copies',async()=>{
 const m=await json('docs/research/provided-yuanshan-20261024/manifest.json');assert.equal(m.uploadCount,6);assert.equal(m.uniqueDocumentCount,4);
 assert.equal(new Set(m.uploads.map(u=>u.sha256)).size,4);
 for(const u of m.uploads){assert.equal(u.pdfPage,1);const b=await readFile(new URL(u.documentPath,root));assert.equal(createHash('sha256').update(b).digest('hex'),u.sha256);assert.equal(b.length,u.bytes);}
});
