import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { aggregateRegions, treeIndex, prepareSidewalk, scoreSidewalk } from '../src/analysis.js';
import { containsPoint, geometryArea, geometryDistance, perimeterSamples } from '../src/spatial.js';
import { toLngLat, toMeters } from '../src/density.js';

const rectangle = (x, y, w, h) => ({ type: 'Polygon', coordinates: [[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]] });
test('polygon math handles holes, boundaries, multipolygons, areas and distances', () => {
  const geometry = rectangle(0,0,100,100);
  geometry.coordinates.push(rectangle(40,40,20,20).coordinates[0]);
  assert.equal(geometryArea(geometry), 9600);
  assert.equal(containsPoint([0,50],geometry), true);
  assert.equal(containsPoint([50,50],geometry), false);
  assert.equal(geometryDistance([50,50],geometry), 10);
  assert.equal(geometryDistance([110,50],geometry), 10);
  assert.equal(containsPoint([205,5],{type:'MultiPolygon',coordinates:[geometry.coordinates,rectangle(200,0,10,10).coordinates]}),true);
  const samples = perimeterSamples(geometry);
  assert.equal(samples.length,40);
  assert.equal(samples.reduce((n,s)=>n+s.weight,0),400);
});
test('length-normalized sidewalk score penalizes trees clustered at one end', () => {
  const geometry = rectangle(303000,2770000,100,4);
  const walk = { geometry, bounds:[303000,2770000,303100,2770004],length:100,samples:perimeterSamples(geometry) };
  const uniform = Array.from({length:10},(_,i)=>toLngLat([303005+i*10,2770002]));
  const clustered = Array.from({length:10},(_,i)=>toLngLat([303001+i/10,2770002]));
  const score = coordinates => scoreSidewalk(walk,treeIndex([{id:'street-trees',coordinates}]),{radius:10,target:10,coverageGoal:.7});
  const a=score(uniform), b=score(clustered);
  assert.equal(a.count,10); assert.equal(b.count,10);
  assert.equal(a.score,1); assert.ok(b.score<.3);
  assert.equal(scoreSidewalk({...walk,length:null},treeIndex([])).score,null);
  assert.equal(scoreSidewalk(walk,treeIndex([])).score,0);
  const wgs={type:'Feature',geometry:{type:'Polygon',coordinates:geometry.coordinates.map(r=>r.map(toLngLat))},properties:{SW_LENG_ItemValue:100}};
  assert.ok(Math.abs(prepareSidewalk(wgs).bounds[0]-303000)<.001);
});
test('radius matches polygon distance without assuming trees are inside the narrow sidewalk', () => {
  const geometry = rectangle(303000,2770000,100,4);
  const walk={geometry,bounds:[303000,2770000,303100,2770004],length:100,samples:perimeterSamples(geometry)};
  const index=treeIndex([{id:'street-trees',coordinates:[toLngLat([303050,2770011]),toLngLat([303050,2770020])]}]);
  assert.equal(scoreSidewalk(walk,index,{radius:5}).count,0);
  assert.equal(scoreSidewalk(walk,index,{radius:10}).count,1);
  assert.equal(scoreSidewalk(walk,index,{radius:20}).count,2);
});
test('real official boundaries and membership reconcile with both source tree datasets',async()=>{
  const regions=JSON.parse(await readFile(new URL('../public/data/regions.json',import.meta.url)));
  const manifest=JSON.parse(await readFile(new URL('../public/data/manifest.json',import.meta.url)));
  assert.equal(regions.treeSnapshot,manifest.fetchedAt);
  assert.equal(regions.features.length,456); assert.equal(regions.districts.length,12);
  assert.equal(new Set(regions.features.map(v=>v.properties.id)).size,456);
  const datasets=await Promise.all(['street-trees','park-trees'].map(async id=>({id,features:JSON.parse(await readFile(new URL(`../public/data/${id}.geojson`,import.meta.url))).features})));
  const district=aggregateRegions(regions,datasets,'district'),village=aggregateRegions(regions,datasets,'village');
  const total=datasets.reduce((n,d)=>n+d.features.length,0);
  assert.equal(district.rows.reduce((n,r)=>n+r.count,0)+district.unmatched,total);
  assert.equal(village.rows.reduce((n,r)=>n+r.count,0)+village.unmatched,total);
  for(const d of district.rows){
    const villages=village.rows.filter(v=>v.feature.properties.district===d.feature.properties.name);
    assert.equal(d.count,villages.reduce((n,v)=>n+v.count,0));
    assert.ok(Math.abs(d.feature.properties.area-villages.reduce((n,v)=>n+v.feature.properties.area,0))<5);
  }
  const filtered=aggregateRegions(regions,datasets,'village',{district:'大安區',query:'榕樹'});
  assert.ok(filtered.rows.every(r=>r.feature.properties.district==='大安區'));
  assert.ok(filtered.rows.reduce((n,r)=>n+r.count,0)>0);
  // Membership indices are valid; sample assignments agree with geometric containment.
  for(const d of datasets){
    d.features.forEach((tree,i)=>{
      const index=regions.membership[d.id][i];
      assert.ok(index===-1||(index>=0&&index<456));
      if(index>=0&&i%1000===0){
        const polygon=regions.features[index].geometry;
        const projected={type:polygon.type,coordinates:polygon.type==='Polygon'?polygon.coordinates.map(r=>r.map(toMeters)):polygon.coordinates.map(p=>p.map(r=>r.map(toMeters)))};
        assert.ok(containsPoint(toMeters(tree.geometry.coordinates),projected));
      }
    });
  }
});
