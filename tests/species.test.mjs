import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeLabel, speciesName, speciesColor, summarizeSpecies, aggregateSpecies, UNKNOWN_SPECIES } from '../src/species.js';
const f = (TreeType, extra = {}) => ({ properties: { TreeType, ...extra }, bbox: [121.5,25,121.5,25], geometry: { type:'Point', coordinates:[121.5,25] } });
const region = (id, district, name = id) => ({ properties:{ id, district, name }, bbox:[121,24,122,26] });
const regions = { features:[region('a','甲區'),region('b','甲區'),region('c','乙區')], districts:[region('甲區','甲區'),region('乙區','乙區')], membership:{ 'street-trees':[0,1,1,2,-1], 'park-trees':[0,0,2] } };
const datasets = [{id:'street-trees',features:[f('榕樹'),f('樟樹'),f(null),f('榕樹'),f('枯木')]},{id:'park-trees',features:[f('榕樹',{Dist:'甲區',ParkName:'同名公園'}),f('樟樹',{Dist:'甲區',ParkName:'同名公園'}),f('榕樹',{Dist:'乙區',ParkName:'同名公園'})]}];
test('conservative whitespace/fullwidth normalization retains botanical distinctions and mixed labels',()=>{
 assert.equal(normalizeLabel('　ＡＢＣ  樹\t 種　'),'ABC 樹 種');
 assert.equal(speciesName('　'),'未提供／未辨識'); assert.equal(speciesName('unknown'),UNKNOWN_SPECIES);
 assert.notEqual(speciesName('榕'),speciesName('榕樹')); assert.equal(speciesName('榕樹／樟樹'),'榕樹/樟樹');
 assert.equal(speciesColor('榕樹'),speciesColor('榕樹')); assert.notEqual(speciesColor('榕樹'),speciesColor('樟樹'));
});
test('count conservation, raw variants, explicit missing and non-species status',()=>{
 const r=summarizeSpecies([f(' 榕樹 '),f('榕樹'),f(''),f('枯木'),f('不明')]);
 assert.equal(r.total,5); assert.equal(r.known,2); assert.equal(r.missingCount,2); assert.equal(r.statusCount,1);
 assert.equal(r.total,r.known+r.missingCount+r.statusCount); assert.equal(r.composition.reduce((s,r)=>s+r.count,0),r.total);
 assert.equal(r.richness,1); assert.equal(r.shannon,0);assert.equal(r.dominance,1);assert.equal(r.concentration,1);
 assert.equal(r.composition.find(r=>r.name==='榕樹').variants.length,2);
});
test('entropy balanced, skewed, mixed-label, empty and missing-only cases',()=>{
 const equal=summarizeSpecies([f('A'),f('B')]);assert.ok(Math.abs(equal.shannon-Math.log(2))<1e-12);assert.equal(equal.concentration,.5);assert.equal(equal.dominance,.5);
 const skew=summarizeSpecies([f('A'),f('A'),f('A'),f('B'),f('')]);assert.ok(skew.shannon<equal.shannon);assert.equal(skew.dominance,.75);assert.equal(skew.richness,2);
 assert.equal(summarizeSpecies([f('A/B')]).total,1);assert.equal(summarizeSpecies([f('A/B')]).richness,1);
 for(const fs of [[],[f(''),f(null),f('枯木')]]){const r=summarizeSpecies(fs);assert.equal(r.richness,0);assert.equal(r.shannon,null);assert.equal(r.concentration,null);assert.equal(r.dominance,null);assert.deepEqual(r.top3,[])}
});
test('district and village aggregation conserve all assigned and omitted records',()=>{
 for(const level of ['district','village']){const a=aggregateSpecies(regions,datasets,level);assert.equal(a.rows.reduce((s,r)=>s+r.total,0)+a.omitted.total,8);assert.equal(a.summary.total,8);assert.equal(a.omitted.statusCount,1)}
 const a=aggregateSpecies(regions,datasets,'district',{district:'甲區'});assert.equal(a.rows.length,1);assert.equal(a.rows[0].total,5);
 const v=aggregateSpecies(regions,datasets,'village');assert.equal(v.rows.find(r=>r.key==='b').unknown,1);
 assert.equal(aggregateSpecies(regions,[], 'village').rows.length,3);
 assert.throws(()=>aggregateSpecies({...regions,membership:{}},datasets,'district'),/快照/);
});
test('parks retain district/source identity and a missing-name group, never infer boundaries',()=>{
 const r=aggregateSpecies(regions,datasets,'park');assert.equal(r.rows.reduce((s,r)=>s+r.total,0),8);assert.equal(r.rows.filter(r=>r.name.includes('同名公園')).length,2);assert.ok(r.rows.some(r=>r.name.includes('未提供公園名稱')));assert.ok(r.rows.every(r=>r.feature===null));
 const filtered=aggregateSpecies(regions,datasets,'park',{district:'甲區'});assert.equal(filtered.summary.total,2);
});
test('official snapshot species/region counts reconcile without dropping missing records',()=>{
 const root=new URL('../public/data/',import.meta.url);const reg=JSON.parse(readFileSync(new URL('regions.json',root)));
 const ds=['street-trees','park-trees'].map(id=>({id,features:JSON.parse(readFileSync(new URL(id+'.geojson',root))).features}));
 for(const level of ['district','village','park']){const a=aggregateSpecies(reg,ds,level);assert.equal(a.summary.total,162369);assert.equal(a.summary.missingCount,18);assert.equal(a.summary.statusCount,7);assert.equal(a.summary.known,162344);assert.equal(a.assignmentOmissions.total,48);assert.equal(a.rows.reduce((s,r)=>s+r.total,0)+a.omitted.total,a.summary.total);if(level!=='park')assert.equal(a.omitted.total,48)}
});

test('missing-only geographic groups keep their records without fabricated diversity',()=>{
 const reg={features:[region('a','甲區')],districts:[region('甲區','甲區')],membership:{'park-trees':[0,0]}};
 const ds=[{id:'park-trees',features:[f('',{Dist:'甲區',ParkName:'缺種名園'}),f('枯木',{Dist:'甲區',ParkName:'缺種名園'})]}];
 for(const level of ['district','village','park']){const a=aggregateSpecies(reg,ds,level);assert.equal(a.rows[0].total,2);assert.equal(a.rows[0].known,0);assert.equal(a.rows[0].richness,0);assert.equal(a.rows[0].shannon,null);assert.equal(a.rows[0].concentration,null);assert.deepEqual(a.rows[0].top3,[])}
 assert.equal(aggregateSpecies(reg,ds,'park',{query:'缺種名園'}).summary.total,2);
 assert.equal(aggregateSpecies(reg,ds,'village',{query:'無此樹種'}).summary.total,0);
});
