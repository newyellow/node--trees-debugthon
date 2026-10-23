import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchPark,validateSnapshot,createParkLoader,createReviews,normalizeParkName} from '../src/parks/data.js';
import {convertOverpass,stitch} from '../src/parks/osm.js';
import {containsPoint} from '../src/spatial.js';
import {download} from '../scripts/prepare-park-boundaries.mjs';
const ring = (x=121.5,y=25) => [[x,y],[x+.001,y],[x+.001,y+.001],[x,y+.001],[x,y]];
const candidate = {type:'Feature',id:'way/1',properties:{names:['測試公園'],osmVersion:1,osmTimestamp:'2026-10-23T00:00:00Z'},geometry:{type:'Polygon',coordinates:[ring()]}};
const park = {properties:{SeqNo:'1',pm_name:'測試公園'},geometry:{type:'Point',coordinates:[121.5005,25.0005]}};
const snapshot = {type:'FeatureCollection',metadata:{schemaVersion:1,version:'test1',osmBase:'2026-10-23T00:00:00Z'},features:[candidate]};
test('conservative name/location matching and ambiguity',()=>{
 assert.equal(matchPark(park,[candidate]).status,'matched');
 assert.equal(matchPark(park,[candidate,{...candidate,id:'way/2'}]).status,'ambiguous');
 assert.equal(matchPark({...park,properties:{pm_name:'別的公園'}},[candidate]).status,'ambiguous');
 assert.equal(matchPark({...park,geometry:{coordinates:[121.6,25.1]}},[candidate]).status,'unmatched');
 assert.equal(normalizeParkName('臺北 公園'),'台北公園');
});
test('holes and MultiPolygon are preserved and affect matching',()=>{
 const hole = ring(121.5002,25.0002).map(([x,y])=>[121.5002+(x-121.5002)*.6,25.0002+(y-25.0002)*.6]);
 const f = {...candidate,geometry:{type:'MultiPolygon',coordinates:[[ring(),hole],[ring(121.52,25.02)]]}};
 assert.equal(containsPoint(park.geometry.coordinates,f.geometry),false);
 assert.equal(containsPoint([121.5205,25.0205],f.geometry),true);
 assert.equal(matchPark({...park,properties:{pm_name:'別名'}},[f]).status,'unmatched');
 assert.equal(validateSnapshot({...snapshot,features:[f]}).features[0].geometry.coordinates[0].length,2);
});
test('converter joins reversed ways, preserves holes; incomplete fails closed',()=>{
 const points = ring().map(([lon,lat])=>({lon,lat}));
 assert.equal(stitch([points.slice(0,3),points.slice(2).reverse()])[0].length,5);
 const inner = ring(121.5002,25.0002).map(([x,y])=>({lon:121.5002+(x-121.5002)*.6,lat:25.0002+(y-25.0002)*.6}));
 const e = {type:'relation',id:3,version:2,timestamp:'today',tags:{type:'multipolygon',leisure:'park'},members:[{type:'way',ref:4,role:'outer',geometry:points},{type:'way',ref:5,role:'inner',geometry:inner}]};
 assert.equal(convertOverpass({elements:[e]}).features[0].geometry.coordinates[0].length,2);
 assert.equal(convertOverpass({elements:[{...e,members:[{type:'way',ref:4,role:'outer'}]}]}).skipped.length,1);
 assert.throws(()=>convertOverpass({elements:[],remark:'timeout'}));
});
test('local review persistence, version isolation, reset, export, denied writes',()=>{
 const map = new Map(), storage = {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const r = createReviews(storage); r.set(park,snapshot,candidate,'confirmed');
 assert.equal(createReviews(storage).get(park,snapshot,candidate).decision,'confirmed');
 assert.equal(r.get(park,{...snapshot,metadata:{...snapshot.metadata,version:'new'}},candidate),null);
 r.set(park,snapshot,candidate,'rejected'); assert.equal(r.get(park,snapshot,candidate).decision,'rejected');
 assert.match(r.export().scope,/browser-local/); assert.throws(()=>r.set(park,snapshot,candidate,'official'));
 r.reset(); assert.equal(createReviews(storage).get(park,snapshot,candidate),null);
 const denied = createReviews({getItem:()=>'{',setItem:()=>{throw Error('denied');}}); assert.throws(()=>denied.set(park,snapshot,candidate,'confirmed')); assert.equal(denied.get(park,snapshot,candidate),null);
});
test('loader deduplication, failure eviction, schema failure and explicit retry',async()=>{
 let calls=0;
 const loader = createParkLoader({baseUrl:'/prefix/',fetcher:async url=>{ assert.equal(url,'/prefix/data/park-boundaries-osm.geojson'); calls++; if(calls===1) return {ok:false,status:503}; return {ok:true,json:async()=>snapshot}; }});
 await assert.rejects(loader(),/503/); await Promise.all([loader(),loader()]); assert.equal(calls,2);
 const invalid = createParkLoader({baseUrl:'/',fetcher:async()=>({ok:true,json:async()=>({})})}); await assert.rejects(invalid());
});
test('Overpass rate limit is surfaced without tight retries',async()=>{
 let calls=0; await assert.rejects(download(async()=>{calls++;return {ok:false,status:429,headers:new Headers({'Retry-After':'120'})};}),/120/); assert.equal(calls,1);
});
test('real snapshot validates, reports matching quality and provenance',async()=>{
 const raw = JSON.parse(await readFile(new URL('../public/data/park-boundaries-osm.geojson',import.meta.url)));
 validateSnapshot(raw); const parks = JSON.parse(await readFile(new URL('../public/data/parks.geojson',import.meta.url)));
 const counts = {matched:0,ambiguous:0,unmatched:0}; for(const p of parks.features) counts[matchPark(p,raw.features).status]++;
 assert.ok(raw.features.length>1000); assert.equal(Object.values(counts).reduce((a,b)=>a+b),parks.features.length);
 console.log('Park match quality',JSON.stringify(counts),'official',parks.features.length,'OSM',raw.features.length);
 assert.equal(matchPark(parks.features.find(p=>p.properties.pm_name==='大安森林公園'),raw.features).status,'matched');
});
