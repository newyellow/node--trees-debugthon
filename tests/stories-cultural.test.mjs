import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {eligibleReason,selectRecords,youthAnchor,distanceMeters,fetchCollection} from '../src/stories/selection.js';
const read = name=>JSON.parse(fs.readFileSync(new URL('../public/data/'+name+'.geojson',import.meta.url)));
const parks=read('parks'), collections={'street-trees':read('street-trees'),'park-trees':read('park-trees')};
const anchor=youthAnchor(parks);
const fake=(TreeType,extra={},coords=anchor.geometry.coordinates)=>({geometry:{type:'Point',coordinates:coords},properties:{TreeID:'test-only',TreeType,...extra}});
test('exact labels, not substring palms, mango synonyms or poisonous sea mango',()=>{
 for(const label of ['大王椰子','可可椰子','鳳凰木'])assert.ok(eligibleReason('south','street-trees',fake(label)));
 for(const label of ['椰子','未知椰子','黃椰子','海檬果','檬果','芒果樹'])assert.equal(eligibleReason('south','street-trees',fake(label)),null);
 for(const label of ['海檬果','檬果'])assert.equal(eligibleReason('mango','park-trees',fake(label,{ParkName:'青年公園',Dist:'萬華區'}),anchor),null);
});
test('eligibility never searches prose, management field, remarks or disconnected geometry',()=>{
 for(const p of [{ParkName:'他處',Dist:'萬華區',pm_unit:'青年公園管理所',description:'青年公園'}, {ParkName:'青年公園',Dist:'北投區'}])assert.equal(eligibleReason('mango','park-trees',fake('芒果',p),anchor),null);
 assert.equal(eligibleReason('mango','street-trees',fake('芒果',{Dist:'大同區',RegionRemark:'中華路二段'}),anchor),null);
 assert.equal(eligibleReason('mango','street-trees',fake('芒果',{Dist:'中正區',Region:'中華路二段'},[121.5,25.15]),anchor),null);
 assert.equal(eligibleReason('south','parks',fake('鳳凰木')),null);
 assert.equal(eligibleReason('south','street-trees',fake('鳳凰木',{},[NaN,25])),null);
});
test('exact youth reference and snapshot selections preserve feature identity and coordinates',()=>{
 assert.equal(anchor.properties.SeqNo,'992');assert.deepEqual(anchor.geometry.coordinates,[121.505861,25.025110242]);
 const stats={};
 for(const demo of ['south','mango']) {const {records}=selectRecords(demo,collections,parks);stats[demo]={total:records.length,groups:{}};
  assert.equal(new Set(records.map(r=>r.key)).size,records.length);
  for(const r of records){assert.equal(r.feature,collections[r.layer].features[r.index]);assert.equal(r.key,r.layer+':'+r.feature.properties.TreeID);const k=r.layer+'/'+r.feature.properties.TreeType;stats[demo].groups[k]=(stats[demo].groups[k]||0)+1;if(demo==='mango'&&r.layer==='street-trees')assert.ok(distanceMeters(anchor.geometry.coordinates,r.feature.geometry.coordinates)<=1000);}
 }
 console.log('SNAPSHOT',JSON.stringify(stats));
 assert.equal(stats.south.total,3437);assert.equal(stats.mango.total,203);assert.equal(stats.mango.groups['park-trees/芒果'],14);
 const mango=selectRecords('mango',collections,parks).records;
 assert.ok(mango.some(r=>r.key==='park-trees:WH0115001091'));assert.ok(!mango.some(r=>r.key==='street-trees:DT0174210156'));
});
test('empty supported selection is honest; duplicate IDs and missing anchor fail closed',()=>{
 const empty={'street-trees':{type:'FeatureCollection',features:[]},'park-trees':{type:'FeatureCollection',features:[]}};
 assert.equal(selectRecords('south',empty).records.length,0);
 assert.throws(()=>youthAnchor({features:[]}));
 assert.throws(()=>selectRecords('south',{...empty,'street-trees':{type:'FeatureCollection',features:[fake('鳳凰木'),fake('鳳凰木')]}}),/重複/);
});
test('fetch failures and unsupported schemas reject rather than fabricate fallback',async()=>{
 await assert.rejects(fetchCollection('test',async()=>({ok:false,status:503})),/503/);
 await assert.rejects(fetchCollection('test',async()=>({ok:true,json:async()=>({features:[]})})),/FeatureCollection/);
});
