import {parsePlanning,projectPlanning,PLANNING_FILE,PLANNING_CITATION} from './plant-advice-planning.mjs';
import {parseEcology,projectEcology,ECOLOGY_FILE,ECOLOGY_CITATION} from './plant-advice-ecology.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,sep} from 'node:path';
import {applySocialMetrics,GAME_SHA256,BLUEPRINT_NAMES} from '../src/workspaces/02/social-metrics.js';
import {HttpError} from './plant-advice-validation.mjs';
const sha = b => createHash('sha256').update(b).digest('hex');
const fail = () => {throw new Error('Authoritative advice data validation failed');};
export function summarizeSourceSpecies(records) {
  const counts=new Map();
  for(const r of records) {const raw=r.feature?.properties?.TreeType; const name=typeof raw==='string'&&raw.length ? raw : '未提供／未辨識'; counts.set(name,(counts.get(name)||0)+1);}
  return [...counts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh-TW')).slice(0,20);
}
export function groundVillage(v, records, blueprint, snapshot) {
  return {village:{name:v.name,district:v.district},snapshot,recordCounts:{trees:v.trees,protected:v.protected,sourceLabelRichness:v.richness},scores:v.scores,
    sourceSpecies:summarizeSourceSpecies(records),demo:{nativeProxy:v.socialMetrics.native,birdInsect:v.socialMetrics.birdInsect,activity:v.socialMetrics.activity},
    limitations:['僅管理樹紀錄，不是全里所有樹木或現況普查。','richness 是來源用名類別數，不是已鑑定物種數。','密度與分數為快照比較，不代表生態品質、遮蔭或可種植性。','原生比例僅19用名比對DEMO代理，未列名不代表非原生；鳥蟲與活動是模擬DEMO，不是真實觀測或回報。','分區為使用者提供未獨立驗證構想，不是官方政策、精確界線或適種保證。'],blueprint};
}
export async function loadGrounding({root}) {
  const data=resolve(root,'data');
  const read=async(file,hash)=>{const path=resolve(data,file);if(!path.startsWith(data+sep))fail();const b=await readFile(path);if(hash&&sha(b)!==hash)fail();return JSON.parse(b);};
  const game=await read('village-game.json',GAME_SHA256), metrics=await read('social-metrics.json');
  const applied=applySocialMetrics(game,metrics), manifest=await read('village-trees/manifest.json');
  if(manifest.schemaVersion!==1||manifest.treeSnapshot!==game.treeSnapshot||Object.keys(manifest.villages||{}).length!==456)fail();
  for(const [k,h] of Object.entries(game.inputHashes)) if(manifest.sourceHashes?.[k]!==h)fail();
  if(manifest.sourceHashes?.['village-game.json']!==GAME_SHA256)fail();
  const planning=parsePlanning(await readFile(resolve(data,PLANNING_FILE)));
  const ecology=parseEcology(await readFile(resolve(data,ECOLOGY_FILE)));
  const knowledge=await read('plant-advice-knowledge.json');
  if(knowledge.schemaVersion!==1||knowledge.status!=='user-provided-planning-proposal-unverified'||!Array.isArray(knowledge.regions)||knowledge.regions.length!==4||JSON.stringify([...new Set(knowledge.regions.flatMap(r=>r.plants))])!==JSON.stringify(BLUEPRINT_NAMES))fail();
  // Explicit public projection: extra fields never reach inference.
  const {title,receivedDate,attribution,status,principle,caveat,homeCaveat}=knowledge;
  const blueprint={title,receivedDate,attribution,status,principle,caveat,homeCaveat,regions:knowledge.regions.map(({id,name,districts,plants})=>({id,name,districts,plants}))};
  const villages=new Map(applied.villages.map(v=>[v.id,v]));
  const sources=[{title:'臺北市公園處樹木分布圖（公開快照）',url:'https://data.gov.tw/dataset/128274'},{title:'臺北市受保護樹木名冊（公開快照）',url:'https://data.taipei/dataset/detail?id=d9d1140b-c2c3-405f-8dd1-7b87b00f6f53'},{title:'臺北市里界圖（公開快照）',url:'https://data.taipei/dataset/detail?id=6b17b31d-4e16-495e-95b1-9fd1f47c80d8'},{title:'臺北市植群分區圖｜使用者提供洪睿晉規劃構想，2026-10-24 收件，來源歸屬未獨立驗證；非官方政策'},{title:'Trees social-demo-v1｜19用名比對代理、鳥蟲與活動DEMO（非觀測）'}];
  sources.push(ECOLOGY_CITATION,PLANNING_CITATION);
  return {sources,async get(id) {
    const v=villages.get(id), entry=manifest.villages[id];
    if(!v)throw new HttpError(400,'找不到指定的里。');
    if(!entry||entry.id!==id||entry.count!==v.trees||!/^villages\/[A-Za-z0-9_-]+\.json$/.test(entry.file)||!/^[a-f0-9]{64}$/.test(entry.sha256))fail();
    const shard=await read('village-trees/'+entry.file,entry.sha256);
    if(shard.schemaVersion!==1||shard.villageId!==id||shard.treeSnapshot!==game.treeSnapshot||!Array.isArray(shard.records)||shard.records.length!==v.trees)fail();
    const counts={'street-trees':0,'park-trees':0},seen=new Set();
    for(const r of shard.records){const key=JSON.stringify([r.layerId,r.treeId]);if(!Object.hasOwn(counts,r.layerId)||typeof r.treeId!=='string'||r.feature?.properties?.TreeID!==r.treeId||seen.has(key))fail();seen.add(key);counts[r.layerId]++;}
    if(Object.keys(counts).some(k=>counts[k]!==entry.byLayer?.[k]))fail();
    return {...groundVillage(v,shard.records,blueprint,game.treeSnapshot),ecology:projectEcology(ecology,v.district,blueprint),planning:projectPlanning(planning,v.district)};
  }};
}
