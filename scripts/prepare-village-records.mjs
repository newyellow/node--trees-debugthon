import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import RBush from 'rbush';
import { parseCSV, validCoordinate } from '../src/workspaces/02/domain.js';
import { containsPoint, mapGeometry } from '../src/spatial.js';
import { toMeters } from '../src/density.js';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const SOURCE_CONFIG = Object.freeze({protected:{id:'protected-trees',encoding:'utf-8',color:'#e58b19'},bins:{id:'clean-bins',encoding:'big5',color:'#1685b5'}});
export function decodeSource(bytes,key) {
  if (!SOURCE_CONFIG[key]) throw new Error('Unknown source: '+key);
  return parseCSV(bytes,SOURCE_CONFIG[key].encoding);
}
export { validCoordinate };
export function verifySourceBytes(bytes,source) {
  if (sha256(bytes)!==source.sha256) throw new Error('BLOCKED SOURCE_SHA_MISMATCH: '+source.key+'.csv');
  if (source.encoding!==SOURCE_CONFIG[source.key]?.encoding) throw new Error('BLOCKED SOURCE_ENCODING: '+source.key);
}
export function sourceIdentity(row,key) {
  return key==='protected' ? row['樹木編號'].trim() : JSON.stringify([row['地址'].trim(),+row['經度'],+row['緯度']]);
}
export function createAssigner(regions) {
  const index=new RBush();
  index.load(regions.features.map((f,i)=>({minX:f.bbox[0],minY:f.bbox[1],maxX:f.bbox[2],maxY:f.bbox[3],i,geometry:mapGeometry(f.geometry,toMeters)})));
  return (lng,lat)=>{const p=toMeters([lng,lat]);return index.search({minX:lng,maxX:lng,minY:lat,maxY:lat}).filter(v=>containsPoint(p,v.geometry)).sort((a,b)=>a.i-b.i)[0]?.i??-1;};
}
export function prepareRecords(rows,key,assign=()=>-1,regions={features:[]}) {
  const audit={raw:rows.length,invalidCoordinates:0,missingIdentity:0,duplicates:0,conflictingDuplicates:0,uniqueValid:0,assigned:0,unmatched:0,dbhMissingOrInvalid:0},seen=new Map(),features=[];
  for (const row of rows) {
    if (!validCoordinate(row['經度'],row['緯度'])) {audit.invalidCoordinates++;continue;}
    const coordinates=[+row['經度'],+row['緯度']],identity=sourceIdentity(row,key);
    if (!identity) {audit.missingIdentity++;continue;}
    const position=coordinates.join(',');
    if (seen.has(identity)) {if(seen.get(identity)!==position)throw new Error('Conflicting official ID coordinates: '+identity);audit.duplicates++;continue;}
    seen.set(identity,position);audit.uniqueValid++;
    if (key==='protected'&&(!row['樹胸徑寬度公尺'].trim()||!Number.isFinite(+row['樹胸徑寬度公尺'])||+row['樹胸徑寬度公尺']<=0)) audit.dbhMissingOrInvalid++;
    const i=assign(...coordinates);if(i<0)audit.unmatched++;else audit.assigned++;
    const district=key==='bins'?row['行政區'].trim():(regions.features[i]?.properties.district??'');
    const id=key==='protected'?identity:'derived:address-coordinates:sha256:'+sha256(identity);
    const properties={...row,_name:key==='protected'?row['樹種名稱']:'行人專用清潔箱',_district:district,_search:[...Object.values(row),district].join(' '),_idKind:key==='protected'?'official':'derived-address-coordinates',...(key==='protected'?{_officialId:identity}:{_derivedId:id})};
    features.push({type:'Feature',id,bbox:[...coordinates,...coordinates],geometry:{type:'Point',coordinates},properties});
  }
  const bbox=features.length?[Math.min(...features.map(f=>f.bbox[0])),Math.min(...features.map(f=>f.bbox[1])),Math.max(...features.map(f=>f.bbox[2])),Math.max(...features.map(f=>f.bbox[3]))]:null;
  return {collection:{type:'FeatureCollection',...(bbox?{bbox}:{}),features},audit};
}
export function assertAudit(actual,expected,key) {
  for(const [field,value]of Object.entries(expected))if(actual[field]!==value)throw new Error('BLOCKED AUDIT_MISMATCH: '+key+'.'+field+' '+actual[field]+' != '+value);
  if(actual.raw!==actual.invalidCoordinates+actual.missingIdentity+actual.duplicates+actual.uniqueValid||actual.uniqueValid!==actual.assigned+actual.unmatched)throw new Error('Audit conservation failed');
}
export async function publishRecords(root=new URL('../',import.meta.url)) {
  const read=path=>readFile(new URL(path,root)),snapshot=JSON.parse(await read('public/data/village-game.json')),rb=await read('public/data/regions.json');
  if(sha256(rb)!==snapshot.inputHashes['regions.json'])throw new Error('BLOCKED REGIONS_SHA_MISMATCH');
  const regions=JSON.parse(rb),assign=createAssigner(regions),outputs=[],layers=[];
  for(const [key,config]of Object.entries(SOURCE_CONFIG).filter(([key])=>key==='protected')) {
    const source=snapshot.sources.find(s=>s.key===key);if(!source)throw new Error('BLOCKED SOURCE_METADATA_MISSING: '+key);
    let bytes;try{bytes=await read('test-results/village-sources/'+key+'.csv');}catch(error){if(error.code==='ENOENT')throw new Error('BLOCKED SOURCE_CACHE_MISSING: '+key+'.csv');throw error;}
    verifySourceBytes(bytes,source);
    const {collection,audit}=prepareRecords(decodeSource(bytes,key),key,assign,regions);
    assertAudit(audit,source.audit,key);
    assertAudit(audit,key==='protected'?{raw:3874,uniqueValid:3874,assigned:3871,unmatched:3}:{raw:661,invalidCoordinates:2,duplicates:1,uniqueValid:658,assigned:658,unmatched:0},key);
    const description=key==='protected'?'受保護樹木歷史名冊快照；非即時法定保護狀態認定。資料涵蓋截止標示2023-04-11，來源檔更新2026-03-23；保留3筆未落入里界紀錄。胸徑與胸圍單位維持原始公尺。':'官方行人專用清潔箱紀錄，不代表所有垃圾桶或家戶垃圾收集點；行政區沿用官方欄位。識別碼由地址與原座標衍生，非官方編號。';
    const file=config.id+'.geojson';outputs.push([file,JSON.stringify(collection)]);
    layers.push({id:config.id,title:source.title,color:config.color,kind:'point',source:source.source,file,valid:collection.features.length,description,agency:source.agency,license:source.license,licenseUrl:source.licenseUrl,sourceSha256:source.sha256,sourceFetchedAt:source.fetchedAt,fetchedAt:source.fetchedAt,sourceFileUpdated:source.sourceFileUpdated,metadataCoverageEnd:source.metadataCoverageEnd??null,sourceEncoding:config.encoding,sourceUrl:source.url,coordinateSystem:'WGS84 longitude/latitude (source values, no geocoding)',identity:key==='protected'?'official 樹木編號':'derived SHA-256 of JSON [trimmed address, numeric longitude, numeric latitude]; not official',districtMethod:key==='bins'?'official 行政區':'version-pinned regions polygon join; unmatched remains blank',boundarySha256:snapshot.inputHashes['regions.json'],audit,bbox:collection.bbox,temporalNote:'擷取日期不是調查日期；未新增觀測、定位或下載。'});
  }
  outputs.push(['village-record-layers.json',JSON.stringify({schemaVersion:1,layers})]);
  // Validate all inputs first; stage all outputs; atomic rename each, metadata last.
  // Individual files are atomic, not a filesystem-wide multi-file transaction.
  const staged=[];
  try{for(const [name,text]of outputs){const target=new URL('public/data/'+name,root),temp=new URL(target.href+'.'+process.pid+'.tmp');await writeFile(temp,text,{flag:'wx'});staged.push([temp,target]);}for(const [temp,target]of staged)await rename(temp,target);}
  finally{await Promise.all(staged.map(([temp])=>unlink(temp).catch(error=>{if(error.code!=='ENOENT')throw error;})));}
  return layers.map(l=>({id:l.id,bytes:Buffer.byteLength(outputs.find(([file])=>file===l.file)[1]),audit:l.audit,sourceSha256:l.sourceSha256}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await publishRecords(),null,2));
