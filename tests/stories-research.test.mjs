import test from 'node:test';
import assert from 'node:assert/strict';
import {filterEntries,validateResearchData,safeSourceURL} from '../src/stories/research-model.js';
// Synthetic fixture only: never publish this as research data.
export const fixture = {schemaVersion:1,updatedAt:'2026-10-24',description:'TEST ONLY 研究測試',coverageNote:'TEST ONLY，不是真實史料',entries:[
 {id:'test-a',species:['測試樹甲'],location:'測試地甲',period:'TEST 1900',title:'測試標題 <img src=x onerror=alert(1)>',summary:'TEST ONLY 文化記憶',evidenceScope:'site-history',verificationStatus:'source-supported',limitations:'TEST ONLY 無逐株比對',sources:[{title:'測試原文',publisher:'TEST publisher',url:'https://example.org/test-a',publishedAt:null,accessedAt:'2026-10-24',locator:'TEST 第 2 段',excerpt:'TEST ONLY 植栽線索 alpha beta'}]},
 {id:'test-b',species:['測試樹乙'],location:'測試地乙',period:'年代待查',title:'待查測試',summary:'TEST ONLY',evidenceScope:'general-context',verificationStatus:'lead',limitations:'TEST ONLY 待查',sources:[{title:'測試來源乙',publisher:'TEST',url:'https://example.org/test-b',publishedAt:'2026-01-01',accessedAt:'2026-10-24',locator:'TEST 章節',excerpt:'TEST ONLY'}]}
]};
test('research schema accepts explicit test fixture and empty collection',()=>{
 assert.equal(validateResearchData(fixture),fixture);assert.equal(validateResearchData({...fixture,entries:[]}).entries.length,0);
});
test('schema rejects malformed data, duplicate ids, invalid scopes and unsafe source links',()=>{
 for(const change of [d=>d.schemaVersion=2,d=>d.entries.push(d.entries[0]),d=>d.entries[0].evidenceScope='unknown',d=>d.entries[0].verificationStatus='verified',d=>d.entries[0].sources[0].url='javascript:alert(1)',d=>delete d.entries[0].sources[0].publishedAt,d=>d.entries[0].species=[],d=>d.entries[0].sources=[]]){
  const copy=structuredClone(fixture);change(copy);assert.throws(()=>validateResearchData(copy));
 }
 assert.equal(safeSourceURL('data:text/html,hello'),null);assert.equal(safeSourceURL('/relative'),null);
});
test('filter species, location, fulltext tokens, statuses and combined queries',()=>{
 const entries=fixture.entries;
 assert.equal(filterEntries(entries).length,2);
 assert.equal(filterEntries(entries,{species:'樹甲',location:'地甲',query:'ALPHA beta',status:'source-supported'}).length,1);
 assert.equal(filterEntries(entries,{query:'無逐株比對'}).length,1);
 assert.equal(filterEntries(entries,{query:'TEST publisher'}).length,1);
 assert.equal(filterEntries(entries,{status:'lead'})[0].id,'test-b');
 assert.equal(filterEntries(entries,{species:'樹甲',status:'lead'}).length,0);
 assert.equal(filterEntries(entries,{query:'no-match'}).length,0);
});
