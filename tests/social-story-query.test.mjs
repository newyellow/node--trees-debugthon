import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { queryStories, createStoryQueryLoader } from '../src/workspaces/02/story-query.js';
const catalogue = JSON.parse(await readFile(new URL('../public/data/tree-cultural-stories.json', import.meta.url), 'utf8'));
const groups = r => ['local','regional','general','leads'].flatMap(k => r[k]);
const entry = (location, extra = {}) => ({ id: location, species:['榕樹'], location, title:'Test fixture, not a historical claim', summary:'Fixture only', evidenceScope:'site-history', verificationStatus:'source-supported', sources:[], ...extra });

test('real 54-entry catalogue: all exact species matches conserved once and source fields intact', () => {
  assert.equal(catalogue.entries.length, 54);
  for (const species of new Set(catalogue.entries.flatMap(e => e.species))) {
    if (species === '未載明樹種') continue;
    const result = queryStories(catalogue, { species, village:'大屯里', district:'北投區' });
    const expected = catalogue.entries.filter(e => e.species.includes(species));
    assert.equal(result.metadata.matchedCount, expected.length);
    assert.deepEqual(new Set(groups(result)), new Set(expected));
    assert.equal(groups(result).length, expected.length);
    for (const e of groups(result)) { assert.ok(expected.includes(e)); assert.equal(e.sources, expected.find(v => v === e).sources); }
    assert.ok(result.leads.every(e => e.verificationStatus === 'lead'));
    for (const key of ['local','regional','general']) assert.ok(result[key].every(e => e.verificationStatus === 'source-supported'));
    assert.deepEqual(result, queryStories(catalogue, { species, village:'大屯里', district:'北投區' }));
  }
});

test('real location: explicit district/village only; parks and district hits are not village stories', () => {
  const citrus = catalogue.entries.find(e => e.id === 'beitou-citrus-naming-orchard-memory');
  for (const village of ['大屯里','泉源里']) assert.ok(queryStories(catalogue, {species:citrus.species[0], village, district:'北投區'}).local.includes(citrus));
  assert.ok(!queryStories(catalogue, {species:citrus.species[0], village:'大屯里', district:'士林區'}).local.includes(citrus));
  const fuyuan = catalogue.entries.find(e => e.id === 'community-fuyuan-second-opinion');
  const result = queryStories(catalogue, {species:'榕樹', village:'民生里', district:'松山區'});
  assert.ok(result.regional.includes(fuyuan)); assert.ok(!result.local.includes(fuyuan));
  assert.match(result.metadata.labels.regional, /非本里/); assert.match(result.metadata.labels.general, /非本里/);
});

test('no fuzzy taxonomy, aliases, mixed categories, missing-label matches or string coercion', () => {
  for (const species of ['榕','Ficus microcarpa','櫻花','台灣欒樹','未載明樹種','unknown','未提供／未辨識','烏?',null,{},['榕樹']]) assert.equal(groups(queryStories(catalogue,{species})).length,0);
  const c = {entries:[entry('臺北市北投區大屯里', {species:['ＡＢＣ','榕樹／樟樹']})]};
  assert.equal(groups(queryStories(c,{species:' ABC '})).length,1);
  assert.equal(groups(queryStories(c,{species:'榕樹'})).length,0);
  assert.equal(groups(queryStories(c,{species:'abc'})).length,0);
});

test('adversarial locality and malicious strings stay data, leads never promoted', () => {
  const good = entry('臺北市北投區大屯里');
  const bad = ['臺北市士林區大屯里','臺北市北投區新大屯里','臺北市北投區大屯里程','臺北市北投區某公園；士林區大屯里','臺北市新北投區大屯里','大屯里','北投區某公園'].map(location => entry(location, {summary:'北投區大屯里', title:'大屯里'}));
  const lead = entry(good.location, {verificationStatus:'lead',sources:[{kind:'provided-document',url:null,documentPath:'docs/research/example.pdf'}]});
  const malicious = entry('<img src=x onerror=alert(1)>', {title:'<script>alert(1)</script>',sources:[{url:'javascript:alert(1)'}]});
  const c = {entries:[good,...bad,lead,malicious]}, before = structuredClone(c);
  const result = queryStories(c,{species:'榕樹',district:'北投區',village:'大屯里'});
  assert.deepEqual(result.local,[good]); assert.deepEqual(result.leads,[lead]); assert.ok(result.general.includes(malicious)); assert.deepEqual(c,before);
  assert.equal(result.general.at(-1).sources[0].url,'javascript:alert(1)');
  assert.equal(queryStories(c,{species:'榕樹',district:'[.*',village:'(.*)'}).local.length,0);
});

test('loader lazy single request, concurrent dedup, cached real catalogue and prefix URL', async () => {
  let calls = 0, release, requested;
  const wait = new Promise(resolve => {release=resolve;});
  const loader = createStoryQueryLoader({base:'/review/',fetcher:async (url, options) => {calls++;requested=url;assert.ok(options.signal instanceof AbortSignal);await wait;return new Response(JSON.stringify(catalogue));}});
  assert.equal(calls,0);
  const a=loader.load(), b=loader.load(); assert.equal(a,b); assert.equal(calls,1); release();
  const loaded = await a; assert.equal(loaded.entries.length,54); assert.equal(await loader.load(), loaded); assert.equal(calls,1); assert.equal(requested,'/review/data/tree-cultural-stories.json');
});

test('loader explicit errors clear failed cache and allow retry for HTTP, transport, parse and schema', async () => {
  const failures = [() => new Response('',{status:503}), () => {throw new Error('offline');}, () => new Response('{'), () => new Response('{"entries":null}')];
  for (const failure of failures) {
    let calls=0;
    const loader=createStoryQueryLoader({base:'/',fetcher:async()=>++calls===1?failure():new Response(JSON.stringify(catalogue))});
    await assert.rejects(loader.load()); assert.equal((await loader.load()).entries.length,54); await loader.load(); assert.equal(calls,2);
  }
});

test('loader bounds declared and streamed size and entry count, retry remains possible', async () => {
  for (const response of [() => new Response('{}',{headers:{'content-length':'2097153'}}), () => new Response('x'.repeat(2097153)), () => new Response(JSON.stringify({entries:Array(2001).fill(entry('test'))}))]) {
    let calls=0;
    const loader=createStoryQueryLoader({fetcher:async()=>++calls===1?response():new Response(JSON.stringify(catalogue))});
    await assert.rejects(loader.load(), /上限|解析/); assert.equal((await loader.load()).entries.length,54);
  }
});
