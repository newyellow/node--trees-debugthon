import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCoverage,coverageCsv,sha256} from '../scripts/tree-history-coverage.mjs';
const texts=await Promise.all(['docs/research/species-inventory.json','docs/research/species-round1/research-ledger.json','docs/research/species-round1/summary.json'].map(p=>readFile(new URL('../'+p,import.meta.url),'utf8')));
const data=buildCoverage(...texts);
test('471 exact source labels and source hash pins; compact audited totals',()=>{
 const inv=JSON.parse(texts[0]);assert.deepEqual(data.entries.map(({id,label})=>({id,label})),inv.entries.map(({id,label})=>({id,label})));
 assert.equal(data.entries.find(e=>e.id==='species-214').label,'');
 assert.deepEqual(data.summary.statusCounts,{'searched':170,'blocked-search-access':298,'needs-name-review':3});
 assert.equal(data.summary.labelsWithActualRequest,245);assert.equal(data.summary.actualQueryRequests,320);assert.equal(data.summary.labelsWithOnlyBlockedRequests,75);assert.equal(data.summary.labelsBlockedWithoutIndividualRequest,223);
 texts.forEach((text,i)=>assert.equal(data.sourcePins[i].sha256,sha256(text)));
 assert.deepEqual(data.sourcePins.slice(3),inv.inputs);
 assert.equal(data.entries.some(e=>'storyCount' in e || 'bodyReviews' in e),false);
 assert.equal(JSON.stringify(data).includes('candidateURLs'),false);
});
test('generator rejects wrong identities, statuses, source pins and summaries',()=>{
 for(const mutate of [l=>l.entries[0].label+=' ',l=>l.entries[1].id=l.entries[0].id,l=>l.entries[0].searchStatus='blocked-search-access',l=>l.entries[0].queries=[],l=>l.inputPins[0].sha256='0'.repeat(64),l=>l.summary.actualQueryRequests--]){
  const ledger=JSON.parse(texts[1]);mutate(ledger);assert.throws(()=>buildCoverage(texts[0],JSON.stringify(ledger),texts[2]));
 }
 assert.throws(()=>buildCoverage(texts[0]+' ',texts[1],texts[2]),/hash/);
 const summary=JSON.parse(texts[2]);summary.actualQueryRequests--;const ledger=JSON.parse(texts[1]);ledger.summary=summary;
 assert.throws(()=>buildCoverage(texts[0],JSON.stringify(ledger),JSON.stringify(summary)),/Summary mismatch/);
});
test('CSV BOM, quotes, multiline and formula protection retain raw blank labels',()=>{
 const sample={entries:[{id:'=id',label:'  +formula,"quoted"',recordCount:1,searchStatus:'searched',queryCount:1,queries:[{query:'@cmd',requestURL:'https://example.org/',accessedAt:'date',outcome:'usable-results'}]},{id:'blank',label:'',recordCount:1,searchStatus:'needs-name-review',queryCount:0,queries:[]}]};
 const csv=coverageCsv(sample);assert.equal(csv.charCodeAt(0),65279);assert.ok(csv.includes(String.fromCharCode(39)+'  +formula'));assert.ok(csv.includes(String.fromCharCode(39)+'@cmd'));assert.ok(csv.includes('"blank","",'));assert.ok(csv.endsWith(String.fromCharCode(13,10)));
});
