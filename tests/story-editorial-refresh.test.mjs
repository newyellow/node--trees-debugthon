import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {validateStoryMedia} from '../src/stories/story-media.js';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
test('all54existingstories have genuinely rewritten summaries without changing identity, evidence or source records',async()=>{
 const catalogue=await read('public/data/tree-cultural-stories.json'),audit=await read('docs/research/story-editorial-audit.json');
 const audited=catalogue.entries.filter(e=>audit.entries.some(a=>a.id===e.id));assert.equal(audited.length,54);assert.equal(audit.entries.length,54);assert.equal(new Set(audit.entries.map(x=>x.id)).size,54);
 assert.deepEqual(audit.entries.map(x=>x.id),audited.map(x=>x.id));
 for(const [n,e]of audited.entries()){
  const a=audit.entries[n];const {summary,images,imageNote,...immutable}=e;
  assert.equal(hash(summary),a.summaryAfterSHA256,e.id);assert.notEqual(a.summaryBeforeSHA256,a.summaryAfterSHA256,e.id);assert.equal(hash(JSON.stringify(immutable)),a.immutableSHA256,e.id);assert.ok(summary.length>=45,e.id);validateStoryMedia(e);
 }
});
test('each stored article image is the exact audited file and has truthful distinct provenance in both consumers',async()=>{
 const catalogue=await read('public/data/tree-cultural-stories.json'),media=await read('public/data/social-story-media.json');
 for(const e of catalogue.entries)for(const image of e.images??[]){
  const bytes=await fs.readFile(new URL('public/'+image.path,root));assert.equal(hash(bytes),image.sha256,e.id);assert.ok(bytes.length<5*1024*1024);assert.ok((media.entries[e.id].images??[media.entries[e.id].image]).some(i=>JSON.stringify(i)===JSON.stringify(image)),e.id);
  assert.ok(e.sources.some(s=>s.url===image.sourcePage),e.id);
  if(image.provenance==='source-attributed'){assert.equal(media.entries[e.id].status,'source-attributed');assert.equal(image.editorialUse,'source-article-context');assert.ok(image.originalImageURL.startsWith('https://'));assert.ok(image.rightsNote.trim());}
 }
 const auditedIDs=new Set((await read('docs/research/story-editorial-audit.json')).entries.map(e=>e.id)),audited=catalogue.entries.filter(e=>auditedIDs.has(e.id));assert.equal(media.editorialAudit.summariesRewritten,54);assert.equal(media.editorialAudit.withStoredArticlePhotos,audited.filter(e=>e.images?.length).length);
 assert.deepEqual(media.editorialAudit.missingArticlePhoto,audited.filter(e=>!e.images?.length).map(e=>e.id));
});
