import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { hostname } from "node:os";
import { setTimeout as waitTimer } from "node:timers/promises";
const MESSAGES = Object.freeze({"planting": "請用四個以空白行分隔的短段落，像植物朋友聊本里的未來願景：整體山系綠網願景；有依據的研究與本里綠網機會連結；實際樹木組成與養護方向；直接行動優先序及2至3種候選。山名、鄰近、地質只用資料支持，不編造。沒有樹況證據不建議移除。約180至240字，不重複免責註記。plants請完整對應第四段所有候選，讓介面配資料庫照片與詳細介紹。", "home": "請像植物朋友寫可獨立閱讀的完整居家建議，用空白行分成明亮陽台與室內擺飾兩組，每組1至2種，總共推薦2至4種具名植物，各給一句簡短理由。室內依明亮散射光或較少光的實際適合情境，少光不等於無光。可用有依據的山系或鄰里綠網作輕巧意象，不推定我家日照、寵物或安全，不把山系植物自動當室內適種。約120至180字，相關誤食風險短註於植物旁；不要邀請聊天、索取條件或在結尾提問。plants完整列出兩組全部候選，最多4種，讓介面配精確照片與介紹。"});
const hash = (b) => createHash("sha256").update(b).digest("hex");
const now = () => (/* @__PURE__ */ new Date()).toISOString();
function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
function openDatabase(path) {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS runs(version TEXT PRIMARY KEY,metadata TEXT NOT NULL,createdAt TEXT NOT NULL);CREATE TABLE IF NOT EXISTS jobs(version TEXT NOT NULL REFERENCES runs(version),villageId TEXT NOT NULL,mode TEXT NOT NULL CHECK(mode IN ('planting','home')),status TEXT NOT NULL CHECK(status IN ('pending','inflight','success','error')),attempts INTEGER NOT NULL DEFAULT 0,updatedAt TEXT NOT NULL,startedAt TEXT,completedAt TEXT,errorCode TEXT,input TEXT NOT NULL,grounding TEXT NOT NULL,groundingHash TEXT NOT NULL,result TEXT,notBefore TEXT,retryCount INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(version,villageId,mode));CREATE TABLE IF NOT EXISTS attempts(version TEXT NOT NULL,villageId TEXT NOT NULL,mode TEXT NOT NULL,attempt INTEGER NOT NULL,startedAt TEXT NOT NULL,completedAt TEXT,outcome TEXT NOT NULL,PRIMARY KEY(version,villageId,mode,attempt));");
  return db;
}
async function acquireLock(dir) {
  await mkdir(dir, { recursive: true, mode: 448 });
  const path = dir + "/process.lock", token = randomUUID();
  for (let n = 0; n < 2; n++) try {
    await writeFile(path, JSON.stringify({ pid: process.pid, host: hostname(), token }), { flag: "wx", mode: 384 });
    return async () => {
      if (JSON.parse(await readFile(path)).token === token) await unlink(path);
    };
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    const old = JSON.parse(await readFile(path));
    if (old.host !== hostname() || !Number.isSafeInteger(old.pid)) throw Error("Lock owner unverifiable");
    try {
      process.kill(old.pid, 0);
      throw Error("Batch already running");
    } catch (check) {
      if (check.code !== "ESRCH") throw check;
    }
    throw Error("Stale process.lock; verify dead owner then remove lock manually");
  }
  throw Error("Lock contention");
}
function recoverInflight(db, version) {
  transaction(db, () => {
    db.prepare("UPDATE attempts SET outcome='uncertain-interrupted',completedAt=? WHERE version=? AND outcome='inflight'").run(now(), version);
    db.prepare("UPDATE jobs SET status='error',errorCode='uncertain-interrupted',updatedAt=?,completedAt=? WHERE version=? AND status='inflight'").run(now(), now(), version);
  });
}
function validateBatchAnswer(output, mode) {
  const paragraphs = output.answer?.trim().split(/\n\s*\n/);
  if (!paragraphs?.length || mode === "planting" && paragraphs.length !== 4 || mode === "home" && paragraphs.length < 2) throw Error("validation-paragraphs");
  const p = output.plants;
  if (!Array.isArray(p) || p.length < 2 || p.length > 4) throw Error("validation-species-count");
  if (new Set(p.map((x) => x.name.normalize("NFKC").trim())).size !== p.length || p.some((x) => !x.name || !output.answer.includes(x.name))) throw Error("validation-species-names");
  if (mode === "planting" && p.some((x) => !paragraphs[3].includes(x.name))) throw Error("validation-final-candidates");
  if (mode === "home") {
    const balcony = output.answer.indexOf("\u660E\u4EAE\u967D\u53F0"), indoor = output.answer.indexOf("\u5BA4\u5167\u64FA\u98FE");
    if (balcony < 0 || indoor <= balcony || output.vision) throw Error("validation-home-groups");
    const groups = [output.answer.slice(balcony, indoor), output.answer.slice(indoor)];
    const counts = groups.map((g) => p.filter((x) => g.includes(x.name)).length);
    if (counts.some((n) => n < 1 || n > 2) || counts[0] + counts[1] !== p.length) throw Error("validation-home-groups");
  }
  if (/[?？]\s*$/.test(output.answer) || /(?:告訴我|想聊|歡迎.{0,8}(?:問|聊)|你家呢|要不要|想知道|可以再提供|有需要.{0,8}(?:問|聊))/.test(paragraphs.at(-1))) throw Error("validation-ending");
  return output;
}
function preservingFetch(fetcher, HttpError, boundedRetryAfter) {
  return async (...args) => {
    const r = await fetcher(...args);
    if (r.status === 503) {
      await r.body?.cancel();
      throw new HttpError(503, "upstream-unavailable", boundedRetryAfter(r.headers.get("retry-after")));
    }
    return r;
  };
}
async function processJobs({ db, version, model, validateRequest, formatResponse, sources, HttpError, sleep = (ms) => waitTimer(ms, void 0, { signal }), signal = new AbortController().signal, limit = Infinity, onProgress = () => {
} }) {
  let processed = 0;
  const jobs = db.prepare("SELECT * FROM jobs WHERE version=? AND status='pending' ORDER BY villageId,CASE mode WHEN 'planting' THEN 0 ELSE 1 END").all(version);
  for (const j of jobs) {
    if (signal.aborted || processed >= limit) break;
    const input = validateRequest(JSON.parse(j.input)), grounding = JSON.parse(j.grounding);
    let retries = j.retryCount;
    if (j.notBefore && Date.parse(j.notBefore) > Date.now()) {
      try {
        await sleep(Date.parse(j.notBefore) - Date.now());
      } catch (e) {
        if (signal.aborted) break;
        throw e;
      }
    }
    while (!signal.aborted) {
      const t = now();
      transaction(db, () => {
        db.prepare("UPDATE jobs SET status='inflight',attempts=attempts+1,startedAt=?,updatedAt=?,errorCode=NULL WHERE version=? AND villageId=? AND mode=?").run(t, t, version, j.villageId, j.mode);
        db.prepare("INSERT INTO attempts VALUES(?,?,?,?,?,NULL,'inflight')").run(version, j.villageId, j.mode, db.prepare("SELECT attempts FROM jobs WHERE version=? AND villageId=? AND mode=?").get(version, j.villageId, j.mode).attempts, t);
      });
      let result, code, retry = false, delay = 60;
      try {
        const output = await model(input, grounding, signal);
        validateBatchAnswer(output, input.mode);
        result = formatResponse(output, input, sources, hash(version + "|" + j.villageId + "|" + j.mode));
      } catch (e) {
        code = e.message === "AI \u56DE\u8986\u683C\u5F0F\u7570\u5E38\uFF0C\u8ACB\u624B\u52D5\u91CD\u8A66\u3002" ? "validation-model-output" : /^validation-[a-z-]+$/.test(e.message) ? e.message : e instanceof HttpError && [429, 503].includes(e.status) ? "pre-inference-" + e.status : "uncertain-or-invalid";
        retry = e instanceof HttpError && [429, 503].includes(e.status) && retries < 2 && !signal.aborted;
        delay = Math.min(3600, Math.max(1, Number(e.retryAfter) || 60));
        if (retry) retries++;
      }
      transaction(db, () => {
        db.prepare("UPDATE jobs SET status=?,updatedAt=?,completedAt=?,errorCode=?,result=?,notBefore=?,retryCount=? WHERE version=? AND villageId=? AND mode=?").run(retry ? "pending" : result ? "success" : "error", now(), now(), code || null, result ? JSON.stringify(result) : null, retry ? new Date(Date.now() + delay * 1e3).toISOString() : null, retries, version, j.villageId, j.mode);
        db.prepare("UPDATE attempts SET completedAt=?,outcome=? WHERE version=? AND villageId=? AND mode=? AND outcome='inflight'").run(now(), code || "success", version, j.villageId, j.mode);
      });
      if (!retry) break;
      try {
        await sleep(delay * 1e3);
      } catch (e) {
        if (signal.aborted) break;
        throw e;
      }
    }
    processed++;
    onProgress({ processed, villageId: j.villageId, mode: j.mode });
  }
  return processed;
}
function safeExport(db, version) {
  const run = db.prepare("SELECT metadata FROM runs WHERE version=?").get(version);
  if (!run) throw Error("Unknown version");
  return { schemaVersion: 1, version, metadata: JSON.parse(run.metadata), jobs: db.prepare("SELECT * FROM jobs WHERE version=? ORDER BY villageId,mode").all(version).map((j) => {
    const r = j.result ? JSON.parse(j.result) : null, g = JSON.parse(j.grounding);
    return { villageId: j.villageId, mode: j.mode, status: j.status, attempts: j.attempts, updatedAt: j.updatedAt, errorCode: j.errorCode, groundingHash: j.groundingHash, regionId: g.ecology?.planRegionId || null, ...r ? { answer: r.answer, plants: r.plants.map(({ name, scientificName }) => ({ name, ...scientificName ? { scientificName } : {} })), sources: r.sources.map(({ title, url }) => ({ title, ...url ? { url } : {} })), ...r.tour ? { tour: { kind: r.tour.kind } } : {} } : {} };
  }) };
}
function verifyDatabase(db, version) {
  if (db.prepare("PRAGMA integrity_check").all().some((r) => Object.values(r)[0] !== "ok") || db.prepare("PRAGMA foreign_key_check").all().length) throw Error("SQLite integrity failed");
  const run = db.prepare("SELECT metadata FROM runs WHERE version=?").get(version);
  if (!run) throw Error("Unknown version");
  const m = JSON.parse(run.metadata);
  if (hash(JSON.stringify(m)) !== version) throw Error("Version metadata mismatch");
  const rows = db.prepare("SELECT * FROM jobs WHERE version=?").all(version);
  if (rows.length !== 912 || new Set(rows.map((r) => r.villageId)).size !== 456) throw Error("Coverage mismatch");
  for (const r of rows) {
    if (!m.villageIds.includes(r.villageId) || r.input !== JSON.stringify({ villageId: r.villageId, mode: r.mode, message: m.messages[r.mode], history: [] }) || hash(r.grounding) !== r.groundingHash) throw Error("Grounding integrity mismatch");
    if (r.status === "success") validateBatchAnswer({ ...JSON.parse(r.result), vision: false }, r.mode);
  }
  return { integrity: "ok", expected: 912, counts: Object.fromEntries(db.prepare("SELECT status,count(*) count FROM jobs WHERE version=? GROUP BY status").all(version).map((r) => [r.status, r.count])), complete: rows.every((r) => r.status === "success") };
}
export {
  MESSAGES,
  acquireLock,
  hash,
  openDatabase,
  preservingFetch,
  processJobs,
  recoverInflight,
  safeExport,
  transaction,
  validateBatchAnswer,
  verifyDatabase
};
