import {validateStoryMedia} from '../src/stories/story-media.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => JSON.parse(readFileSync(new URL('../public/data/' + name, import.meta.url), 'utf8'));
const catalogue = read('tree-cultural-stories.json');
const data = read('social-story-media.json');
const report = readFileSync(new URL('../docs/research/social-story-media-audit.md', import.meta.url), 'utf8');
const statuses = ['displayable', 'source-only', 'unavailable', 'blocked', 'provided-document', 'user-provided', 'source-attributed'];
const https = value => { const u = new URL(value); assert.equal(u.protocol, 'https:'); assert.equal(u.username, ''); assert.equal(u.password, ''); };
test('media manifest covers exactly the 54 canonical story IDs', () => {
 assert.equal(data.schemaVersion, 1);
 assert.ok(Number.isFinite(Date.parse(data.updatedAt)));
 assert.equal(catalogue.entries.length, 54);
 assert.equal(Object.keys(data.entries).length, 54);
 assert.deepEqual(Object.keys(data.entries).sort(), catalogue.entries.map(e => e.id).sort());
});
test('displayable images have original source, credit, caption, grant and audit evidence', () => {
 for (const story of catalogue.entries) {
  const entry = data.entries[story.id];
  assert.ok(statuses.includes(entry.status));
  assert.ok(entry.reason?.trim());
  assert.ok(report.includes(story.id));
  if (entry.sourceUrl !== null) {
   https(entry.sourceUrl);
   assert.ok(story.sources.some(s => s.url === entry.sourceUrl));
  }
  if(['user-provided','source-attributed'].includes(entry.status)){validateStoryMedia({images:[entry.image]});assert.deepEqual(entry.image,story.images[0]);assert.ok(report.includes(entry.image.path));continue;}
  if (entry.status !== 'displayable') { assert.equal(Object.hasOwn(entry, 'image'), false); continue; }
  const image = entry.image;
  for (const field of ['url','sourceUrl','license','licenseUrl','credit','caption']) assert.ok(image[field]?.trim(), story.id + ': ' + field);
  for (const field of ['url','sourceUrl','licenseUrl']) { https(image[field]); assert.ok(report.includes(image[field])); }
  assert.equal(image.sourceUrl, entry.sourceUrl);
  assert.match(image.license, /CC0|CC BY|CC-BY|資料開放宣告/);
  assert.ok(report.includes('### ' + story.id));
  assert.ok(report.includes('evidenceQuote:'));
 }
});
test('provided documents cannot invent public URLs or image permissions', () => {
 for (const story of catalogue.entries) {
  const entry = data.entries[story.id];
  if (entry.status === 'provided-document') {
   assert.equal(entry.sourceUrl, null);
   assert.ok(story.sources.every(s => !s.url));
   assert.equal(Object.hasOwn(entry, 'image'), false);
  } else assert.ok(entry.sourceUrl);
 }
});
test('coverage counts are derived from entries and audit request budget is bounded', () => {
 assert.equal(data.coverage.total, 54);
 for (const status of statuses) assert.equal(data.coverage.byStatus[status], Object.values(data.entries).filter(e => e.status === status).length);
 assert.equal(data.coverage.originalArticleRequests, data.coverage.uniqueOriginalSourceUrls);
 assert.ok(data.coverage.originalArticleRequests <= 40);
 assert.equal(data.coverage.readableOriginalSources + data.coverage.blockedOriginalSources, data.coverage.uniqueOriginalSourceUrls);
 assert.equal(data.coverage.verifiedImageUrls, new Set(Object.values(data.entries).filter(e => e.status==='displayable').map(e => e.image.url)).size);
});
