#!/usr/bin/env node
import { readFile, realpath, lstat, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as sleepTimer } from 'node:timers/promises';
import { hash, transaction, acquireLock, openDatabase, verifyDatabase, recoverInflight, validateBatchAnswer, preservingFetch } from './advice-batch-core.mjs';
export const EXISTING_VERSION = '4577aeaa30f65e6052df3bc5d9aef737f3d8f7cc9f5eeb82df5982800c70efab';
export const EXISTING_SOURCE = 'bb7d46631d9628a81ab99111e0123768eeba8274';
const BASE = resolve(homedir(), 'Library/Application Support/TreesDebugthon/advice-batches');
const eligible = "j.version=? AND j.status='pending' AND (j.mode='planting' OR EXISTS (SELECT 1 FROM jobs p WHERE p.version=j.version AND p.villageId=j.villageId AND p.mode='planting' AND p.status IN ('success','error')))";
export function parseArgs(argv) {
  const a = {}; if (argv[0] === 'run') argv = argv.slice(1);
  while (argv.length) {
    const k = argv.shift();
    if (['--prepare-only', '--confirm-old-owner-dead'].includes(k)) a[k.slice(2)] = true;
    else if (['--version', '--concurrency', '--limit', '--stop-file'].includes(k)) {
      if (!argv[0] || argv[0].startsWith('--') || a[k.slice(2)] !== undefined) throw Error('Invalid argument');
      a[k.slice(2)] = argv.shift();
    } else throw Error('Unknown argument');
  }
  if (a.version !== EXISTING_VERSION || !/^[1-3]$/.test(a.concurrency || '')) throw Error('Explicit existing version and concurrency 1..3 required');
  if (a.limit !== undefined && (!/^[1-9]\d*$/.test(a.limit) || !Number.isSafeInteger(Number(a.limit)))) throw Error('Invalid limit');
  if (a['stop-file'] && !isAbsolute(a['stop-file'])) throw Error('Stop file must be absolute');
  return a;
}
// Validate every recorded byte before importing frozen modules; reject symlink escapes.
export async function verifyFrozen(db, version, base = BASE) {
  if (version !== EXISTING_VERSION) throw Error('Unexpected version');
  const row = db.prepare('SELECT metadata FROM runs WHERE version=?').get(version);
  if (!row || hash(row.metadata) !== version) throw Error('Metadata mismatch');
  const m = JSON.parse(row.metadata);
  if (m.sourceSha !== EXISTING_SOURCE || hash(JSON.stringify(m)) !== version) throw Error('Source/version mismatch');
  const files = m.fileHashes;
  if (!files || typeof files !== 'object' || Array.isArray(files) || !Object.keys(files).length) throw Error('Missing hashes');
  const root = await verifyFrozenFiles(base, m.sourceSha, files);
  verifyDatabase(db, version);
  return { root, metadata: m };
}

export async function verifyFrozenFiles(base, sourceSha, files) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw Error('Invalid source SHA');
  const root = resolve(base, 'sources', sourceSha + '-' + hash(JSON.stringify(files)));
  if (await realpath(root) !== root) throw Error('Snapshot path mismatch');
  for (const [p, digest] of Object.entries(files)) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(p) || p.split('/').some(x => !x || x === '.' || x === '..') || isAbsolute(p) || !/^[a-f0-9]{64}$/.test(digest)) throw Error('Unsafe frozen hash/path');
    const target = resolve(root, p);
    if (await realpath(target) !== target || !(await lstat(target)).isFile() || hash(await readFile(target)) !== digest) throw Error('Frozen file mismatch');
  }
  for (const p of ['server/plant-advice-model.mjs', 'server/plant-advice-validation.mjs', 'server/plant-advice-grounding.mjs', 'scripts/advice-batch-core.mjs']) if (!files[p]) throw Error('Missing frozen dependency');
  for (const p of Object.keys(files).filter(p => p.endsWith('.mjs'))) {
    const source = await readFile(resolve(root, p), 'utf8');
    if (!p.startsWith('scripts/') && /import\s*\(/.test(source)) throw Error('Unsupported dynamic import');
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      const dep = match[1];
      if (dep.startsWith('node:')) continue;
      if (!dep.startsWith('.') || !files[resolve('/', dirname(p), dep).slice(1)]) throw Error('Unrecorded dependency');
    }
  }
  return root;
}
export function claimJob(db, version, time, allowed = null) {
  return transaction(db, () => {
    const rows = db.prepare('SELECT j.* FROM jobs j WHERE ' + eligible + " AND (j.notBefore IS NULL OR j.notBefore<=?) ORDER BY j.villageId,CASE j.mode WHEN 'planting' THEN 0 ELSE 1 END").all(version, new Date(time).toISOString());
    const j = rows.find(j => !allowed || allowed.has(j.villageId + '|' + j.mode));
    if (!j) return null;
    const t = new Date(time).toISOString();
    const update = db.prepare("UPDATE jobs SET status='inflight',attempts=attempts+1,startedAt=?,updatedAt=?,errorCode=NULL WHERE version=? AND villageId=? AND mode=? AND status='pending' AND attempts=?").run(t, t, version, j.villageId, j.mode, j.attempts);
    if (update.changes !== 1) throw Error('Claim conflict');
    j.attempts++;
    db.prepare("INSERT INTO attempts VALUES(?,?,?,?,?,NULL,'inflight')").run(version, j.villageId, j.mode, j.attempts, t);
    return j;
  });
}
// One event loop/DB owner. No async operation inside a SQLite transaction.
export async function processParallel({ db, version, model, validateRequest, formatResponse, HttpError, sources, concurrency = 3, limit = Infinity, shouldStop = () => false, onProgress = () => {}, now = Date.now, sleep = sleepTimer }) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3 || !(limit === Infinity || Number.isSafeInteger(limit) && limit > 0)) throw Error('Invalid scheduler limits');
  let currentConcurrency = concurrency, highwater = 0, processed = 0, fatal;
  const active = new Set(), selected = new Set();
  // Persist global cooldown using existing per-job deadlines, including terminal rejections.
  const persisted = db.prepare('SELECT max(notBefore) deadline FROM jobs WHERE version=?').get(version).deadline;
  let cooldown = persisted ? Date.parse(persisted) : 0;
  if (db.prepare("SELECT 1 FROM attempts WHERE version=? AND outcome IN ('pre-inference-429','pre-inference-503') LIMIT 1").get(version)) currentConcurrency = 1;
  if (persisted && !Number.isFinite(cooldown)) throw Error('Invalid persisted deadline');
  // No paying for an invalid persisted retry budget/deadline.
  for (const j of db.prepare("SELECT retryCount,notBefore FROM jobs WHERE version=? AND status='pending'").all(version)) {
    if (!Number.isInteger(j.retryCount) || j.retryCount < 0 || j.retryCount > 2 || j.notBefore && !Number.isFinite(Date.parse(j.notBefore))) throw Error('Invalid retry state');
  }
  const progress = () => onProgress({ processed, selected: selected.size, inflight: active.size, highwater, concurrency: currentConcurrency, requestedConcurrency: concurrency, draining: Boolean(shouldStop()) });
  async function execute(j) {
    let result, code, deadline = null, retry = false;
    try {
      const input = validateRequest(JSON.parse(j.input));
      // Drain signals never reach this signal; frozen client enforces its 45s timeout.
      const output = await model(input, JSON.parse(j.grounding), new AbortController().signal);
      validateBatchAnswer(output, input.mode);
      result = formatResponse(output, input, sources, hash(version + '|' + j.villageId + '|' + j.mode));
    } catch (e) {
      const rejection = e instanceof HttpError && [429, 503].includes(e.status);
      code = rejection ? 'pre-inference-' + e.status : /^validation-[a-z-]+$/.test(e.message || '') ? e.message : e.message === 'AI 回覆格式異常，請手動重試。' ? 'validation-model-output' : 'uncertain-or-invalid';
      if (rejection) {
        currentConcurrency = 1;
        deadline = now() + Math.min(3600, Math.max(1, Number(e.retryAfter) || 60)) * 1000;
        cooldown = Math.max(cooldown, deadline);
        retry = j.retryCount < 2;
      }
    }
    transaction(db, () => {
      const t = new Date(now()).toISOString();
      const updated = db.prepare("UPDATE jobs SET status=?,updatedAt=?,completedAt=?,errorCode=?,result=?,notBefore=?,retryCount=? WHERE version=? AND villageId=? AND mode=? AND status='inflight' AND attempts=?").run(retry ? 'pending' : result ? 'success' : 'error', t, retry ? null : t, code || null, result ? JSON.stringify(result) : null, deadline ? new Date(deadline).toISOString() : null, j.retryCount + (retry ? 1 : 0), version, j.villageId, j.mode, j.attempts);
      const attempt = db.prepare("UPDATE attempts SET completedAt=?,outcome=? WHERE version=? AND villageId=? AND mode=? AND attempt=? AND outcome='inflight'").run(t, code || 'success', version, j.villageId, j.mode, j.attempts);
      if (updated.changes !== 1 || attempt.changes !== 1) throw Error('Completion conflict');
    });
    if (!retry) processed++;
  }
  try {
    while (true) {
      if (fatal) throw fatal;
      if (shouldStop()) { if (!active.size) break; await Promise.race(active); continue; }
      if (cooldown > now()) {
        if (active.size) await Promise.race(active);
        else await sleep(Math.min(250, cooldown - now()));
        continue;
      }
      while (!shouldStop() && active.size < currentConcurrency) {
        if (fatal || cooldown > now()) break;
        const j = claimJob(db, version, now(), selected.size >= limit ? selected : null);
        if (!j) break;
        selected.add(j.villageId + '|' + j.mode);
        let task;
        task = execute(j).catch(e => { fatal = e; }).finally(() => { active.delete(task); progress(); });
        active.add(task); highwater = Math.max(highwater, active.size); progress();
      }
      if (active.size) { await Promise.race(active); continue; }
      const pending = db.prepare('SELECT j.* FROM jobs j WHERE ' + eligible).all(version).filter(j => selected.size < limit || selected.has(j.villageId + '|' + j.mode));
      if (!pending.length) break;
      const deadlines = pending.map(j => j.notBefore ? Date.parse(j.notBefore) : now());
      if (deadlines.some(t => !Number.isFinite(t))) throw Error('Invalid deadline');
      await sleep(Math.min(250, Math.max(1, Math.min(...deadlines) - now())));
    }
  } finally { await Promise.all(active); }
  if (fatal) throw fatal;
  progress(); return { processed, highwater, concurrency: currentConcurrency };
}
export async function main(argv = process.argv.slice(2)) {
  process.umask(0o077);
  const a = parseArgs([...argv]), release = await acquireLock(BASE);
  let db, draining = false;
  const stop = () => { draining = true; };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  try {
    await access(resolve(BASE, 'batches.sqlite'));
    db = openDatabase(resolve(BASE, 'batches.sqlite'));
    const { root, metadata } = await verifyFrozen(db, a.version);
    const mod = p => import(pathToFileURL(resolve(root, p)).href);
    const [{ createModelClient, SYSTEM_PROMPT }, validation, { loadGrounding }] = await Promise.all(['server/plant-advice-model.mjs', 'server/plant-advice-validation.mjs', 'server/plant-advice-grounding.mjs'].map(mod));
    if (hash(SYSTEM_PROMPT) !== metadata.promptHash) throw Error('Prompt mismatch');
    const grounding = await loadGrounding({ root: resolve(root, 'public') });
    console.log(JSON.stringify({ version: a.version, sourceSha: metadata.sourceSha, prepared: true, concurrency: Number(a.concurrency) }));
    if (a['prepare-only']) return;
    const inflight = db.prepare("SELECT count(*) n FROM jobs WHERE version=? AND status='inflight'").get(a.version).n;
    if (inflight && !a['confirm-old-owner-dead']) throw Error('Inflight requires explicit dead-owner confirmation');
    if (inflight) recoverInflight(db, a.version);
    const model = createModelClient({ timeoutMs: 45000, fetcher: preservingFetch(globalThis.fetch, validation.HttpError, validation.boundedRetryAfter) });
    await processParallel({ db, version: a.version, model, ...validation, sources: grounding.sources, concurrency: Number(a.concurrency), limit: a.limit ? Number(a.limit) : Infinity, shouldStop: () => draining || Boolean(a['stop-file'] && existsSync(a['stop-file'])), onProgress: p => console.log(JSON.stringify({ version: a.version, ...p })) });
    console.log(JSON.stringify({ version: a.version, ...verifyDatabase(db, a.version) }));
  } finally {
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    db?.close(); await release();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  console.error(JSON.stringify({ error: 'Parallel batch failed closed; check flags, snapshot integrity, lock and inflight ownership. No provider text logged.' })); process.exitCode = 1;
});
