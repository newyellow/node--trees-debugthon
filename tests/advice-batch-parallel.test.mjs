import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { openDatabase, hash, MESSAGES } from '../scripts/advice-batch-core.mjs';
import { HttpError, validateRequest, formatResponse } from '../server/plant-advice-validation.mjs';
import { processParallel, claimJob, parseArgs, verifyFrozen, EXISTING_VERSION } from '../scripts/advice-batch-parallel.mjs';
const planting = { answer: '綠網願景。\n\n串連綠地。\n\n照顧既有樹。\n\n候選樟樹與月橘。', plants: [{name:'樟樹'}, {name:'月橘'}], vision: true };
const home = { answer: '明亮陽台可考慮月橘。\n\n室內擺飾可考慮黃金葛，避免誤食。', plants: [{name:'月橘'}, {name:'黃金葛'}], vision:false };
function fixture(ids = ['a','b','c','d']) {
 const db = openDatabase(':memory:'), version = hash('test');
 db.prepare('INSERT INTO runs VALUES(?,?,?)').run(version, '{}', 'time');
 for (const id of ids) for (const mode of ['planting','home']) db.prepare("INSERT INTO jobs(version,villageId,mode,status,updatedAt,input,grounding,groundingHash) VALUES(?,?,?,'pending','time',?,'{}',?)").run(version,id,mode,JSON.stringify({villageId:id,mode,message:MESSAGES[mode],history:[]}),hash('{}'));
 return {db,version};
}
const output = i => i.mode === 'planting' ? planting : home;
function run(f, model, extra={}) {return processParallel({...f, model, validateRequest, formatResponse, HttpError, sources:[], ...extra});}
test('three unique claims, village planting terminal before home, exact attempts, resume skips terminal', async () => {
 const f=fixture(), seen=new Set(), progress=[]; let active=0, peak=0;
 const result=await run(f, async i => {
  const key=i.villageId+i.mode; assert.ok(!seen.has(key)); seen.add(key);
  if(i.mode==='home') assert.ok(['success','error'].includes(f.db.prepare("SELECT status FROM jobs WHERE villageId=? AND mode='planting'").get(i.villageId).status));
  active++; peak=Math.max(peak,active); await wait(2); active--; return output(i);
 }, {onProgress:p=>progress.push(p)});
 assert.equal(peak,3); assert.equal(result.highwater,3); assert.equal(seen.size,8);
 assert.equal(f.db.prepare('SELECT count(*) n FROM attempts').get().n,8);
 assert.ok(progress.every(p=>p.inflight<=3)); assert.equal(progress.at(-1).inflight,0);
 await run(f,()=>assert.fail('duplicate')); f.db.close();
});
test('claim never reclaims success/error/inflight; inflight planting blocks home',()=>{
 const f=fixture(['a','b']);
 f.db.prepare("UPDATE jobs SET status='inflight' WHERE villageId='a' AND mode='planting'").run();
 f.db.prepare("UPDATE jobs SET status='error' WHERE villageId='b' AND mode='planting'").run();
 assert.equal(claimJob(f.db,f.version,Date.now()).mode,'home');
 assert.equal(claimJob(f.db,f.version,Date.now()),null); f.db.close();
});
test('drain stops claims, does not abort, commits all already-active results',async()=>{
 const f=fixture(); let stop=false, calls=0; const gates=[];
 const p=run(f,(i,g,signal)=>{calls++; return new Promise(resolve=>gates.push(()=>{assert.equal(signal.aborted,false); resolve(output(i));}));},{shouldStop:()=>stop});
 assert.equal(calls,3); stop=true; gates.forEach(g=>g()); const r=await p;
 assert.equal(calls,3); assert.equal(r.processed,3); assert.equal(f.db.prepare("SELECT count(*) n FROM jobs WHERE status='inflight'").get().n,0); f.db.close();
});
test('persisted retry deadline/budget survives drain and restart; no new claims during global cooldown',async()=>{
 const f=fixture(['a','b']); let clock=100000, stop=false, calls=0;
 await run(f,()=>{calls++; throw new HttpError(429,'private',7);},{concurrency:1,now:()=>clock,shouldStop:()=>stop,sleep:async ms=>{stop=true;}});
 const row=f.db.prepare("SELECT * FROM jobs WHERE villageId='a' AND mode='planting'").get();
 assert.equal(row.retryCount,1); assert.equal(Date.parse(row.notBefore),107000); assert.equal(calls,1);
 stop=false; const times=[];
 await run(f,i=>{times.push(clock); if(i.mode==='planting') throw new HttpError(503,'private',2); return home;},{limit:1,now:()=>clock,sleep:async ms=>{clock+=ms;}});
 assert.deepEqual(times,[107000,109000]);
 assert.equal(f.db.prepare("SELECT retryCount FROM jobs WHERE villageId='a' AND mode='planting'").get().retryCount,2);
 assert.equal(f.db.prepare("SELECT status FROM jobs WHERE villageId='a' AND mode='planting'").get().status,'error');
 assert.doesNotMatch(JSON.stringify(f.db.prepare('SELECT * FROM attempts').all()),/private/); f.db.close();
});
test('429/503 global downshift, finish other inflight, bounded retries without a storm',async()=>{
 for(const status of [429,503]) {
  const f=fixture(), progress=[], times=[]; let clock=100000, active=0, peak=0, rejected=false;
  const r=await run(f,async i=>{
   active++; peak=Math.max(peak,active); times.push(clock); await wait(1); active--;
   if(i.villageId==='a' && i.mode==='planting'){rejected=true; throw new HttpError(status,'private',1);} return output(i);
  },{now:()=>clock,sleep:async ms=>{clock+=ms;},onProgress:p=>progress.push(p)});
  assert.ok(rejected); assert.equal(peak,3); assert.equal(r.concurrency,1);
  assert.ok(times.slice(3).every(t=>t>=101000));
  assert.equal(f.db.prepare("SELECT attempts FROM jobs WHERE villageId='a' AND mode='planting'").get().attempts,3);
  const down=progress.findIndex(p=>p.concurrency===1); assert.ok(down>=0); assert.ok(progress.slice(down).every(p=>p.concurrency===1)); f.db.close();
 }
});
test('uncertain failures and validation errors never retry; home proceeds after planting error',async()=>{
 for(const fail of [()=>{throw new HttpError(502,'private');},()=>({...planting,answer:'bad'})]) {
  const f=fixture(['a']); let calls=0;
  await run(f,i=>{calls++; return i.mode==='planting'?fail():home;}); assert.equal(calls,2);
  assert.equal(f.db.prepare("SELECT attempts FROM jobs WHERE mode='planting'").get().attempts,1); f.db.close();
 }
});
test('CLI failclosed on version/concurrency/limit and snapshot metadata integrity',async()=>{
 const args=['--version',EXISTING_VERSION,'--concurrency','3']; assert.equal(parseArgs([...args]).concurrency,'3');
 for(const a of [[],['--version','a'.repeat(64),'--concurrency','3'],[...args,'--limit','0'],['--version',EXISTING_VERSION,'--concurrency','4'],[...args,'--retry-errors']]) assert.throws(()=>parseArgs(a));
 const f=fixture(); await assert.rejects(verifyFrozen(f.db,f.version),/Unexpected version/);
 f.db.prepare('INSERT INTO runs VALUES(?,?,?)').run(EXISTING_VERSION,'{}','time');
 await assert.rejects(verifyFrozen(f.db,EXISTING_VERSION),/Metadata mismatch/); f.db.close();
});

test('all frozen bytes/full hashes and source path verified with isolated snapshot', async()=>{
 const {mkdtemp,mkdir,writeFile,rm,symlink,realpath}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os'); const {join,dirname}=await import('node:path');
 const {verifyFrozenFiles,EXISTING_SOURCE}=await import('../scripts/advice-batch-parallel.mjs');
 const base=await realpath(await mkdtemp(join(tmpdir(),'parallel-frozen-')));
 const contents={ 'server/plant-advice-model.mjs':"import './plant-advice-validation.mjs';", 'server/plant-advice-validation.mjs':'export const x=1;', 'server/plant-advice-grounding.mjs':'export const x=2;', 'scripts/advice-batch-core.mjs':'export const x=3;', 'public/data/example.json':'{}' };
 const files=Object.fromEntries(Object.entries(contents).map(([p,c])=>[p,hash(c)]));
 const root=join(base,'sources',EXISTING_SOURCE+'-'+hash(JSON.stringify(files)));
 try {
  for(const [p,c] of Object.entries(contents)){await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),c);}
  assert.equal(await verifyFrozenFiles(base,EXISTING_SOURCE,files),root);
  await writeFile(join(root,'public/data/example.json'),'tamper');
  await assert.rejects(verifyFrozenFiles(base,EXISTING_SOURCE,files),/Frozen file mismatch/);
  await rm(join(root,'public/data/example.json')); await writeFile(join(base,'outside'),'{}'); await symlink(join(base,'outside'),join(root,'public/data/example.json'));
  await assert.rejects(verifyFrozenFiles(base,EXISTING_SOURCE,files),/Frozen file mismatch/);
  await assert.rejects(verifyFrozenFiles(base,'bad',files),/Invalid source/);
 } finally {await rm(base,{recursive:true,force:true});}
});
