import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { relativeScore, parseCSV, validCoordinate } from '../src/workspaces/02/domain.js';
import { containsPoint } from '../src/spatial.js';
const root = new URL('../', import.meta.url), read = p => readFile(new URL(p, root));
test('relative scores: zero, ties, singleton, missing and all-zero cohort', () => {
  assert.equal(relativeScore(0,[0,0,0]),0); assert.equal(relativeScore(1,[0,1,1,2]),50);
  assert.equal(relativeScore(2,[0,1,2]),100); assert.equal(relativeScore(1,[1]),100);
  assert.equal(relativeScore(1,[1,1,1]),50); assert.equal(relativeScore(null,[0,1]),null);
  assert.equal(relativeScore(NaN,[0,1]),null); assert.equal(relativeScore(-1,[0,1]),null);
});
test('CSV quoted commas/newlines, BOM, escaped quotes and Big5', () => {
 const nl=String.fromCharCode(10), q=String.fromCharCode(34), cr=String.fromCharCode(13);
 const input=String.fromCharCode(65279)+'a,b'+cr+nl+q+'x,y'+q+','+q+'z'+q+q+'p'+q+cr+nl+q+'line'+nl+'next'+q+',ok';
 assert.deepEqual(parseCSV(input),[{a:'x,y',b:'z'+q+'p'},{a:'line'+nl+'next',b:'ok'}]);
 assert.equal(parseCSV(new Uint8Array([97,10,164,164]),'big5')[0].a,'中');
 assert.throws(()=>parseCSV('a,b'+nl+q+'x,y')); assert.throws(()=>parseCSV('a,b'+nl+'x'));
 assert.equal(validCoordinate('',25),false);
});
test('shared polygon semantics retain holes and include boundary', () => {
  const g = { type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]] };
  assert.equal(containsPoint([1,1],g),true); assert.equal(containsPoint([4,4],g),false); assert.equal(containsPoint([0,5],g),true); assert.equal(containsPoint([3,5],g),true); assert.equal(containsPoint([20,20],g),false);
});
test('derived snapshot conservation, source attribution, identities and all scores', async () => {
  const d = JSON.parse(await read('public/data/village-game.json'));
  assert.equal(d.villages.length,456); assert.equal(new Set(d.villages.map(v => v.id)).size,456);
  assert.equal(d.villages.reduce((s,v) => s+v.trees,0),162321);
  assert.equal(Object.values(d.treeAudit).reduce((s,a) => s+a.unmatched,0),48);
  assert.equal(Object.values(d.treeAudit).reduce((s,a) => s+a.total,0),162369);
  for (const [file,hash] of Object.entries(d.inputHashes)) assert.equal(createHash('sha256').update(await read('public/data/'+file)).digest('hex'),hash);
  assert.equal(d.sources[0].audit.raw,3874); assert.equal(d.sources[1].audit.raw,661);
  for (const s of d.sources) {
    const a = s.audit; assert.ok(s.source.startsWith('https://')); assert.ok(s.licenseUrl.startsWith('https://'));
    assert.equal(a.raw,a.invalidCoordinates+a.missingIdentity+a.duplicates+a.uniqueValid);
    assert.equal(a.uniqueValid,a.assigned+a.unmatched);
    assert.equal(d.villages.reduce((sum,v) => sum+v[s.key],0),a.assigned);
  }
  for (const v of d.villages) {
    assert.equal(v.native,null); assert.equal(v.birdsInsects,null); assert.ok(v.areaKm2>0);
    assert.equal(v.trees,v.knownNames+v.missingNames+v.deadStatus);
    for (const k of ['treeDensity','protectedDensity','richness','binDensity']) assert.equal(v.scores[k],relativeScore(v[k],d.villages.map(r => r[k])));
  }
});
