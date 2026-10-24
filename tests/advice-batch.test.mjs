import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, hash, MESSAGES, transaction, processJobs, recoverInflight, validateBatchAnswer, preservingFetch, safeExport, verifyDatabase, acquireLock } from "../scripts/advice-batch-core.mjs";
import { HttpError, validateRequest, formatResponse, boundedRetryAfter } from "../server/plant-advice-validation.mjs";
const planting = { answer: "\u7DA0\u7DB2\u9858\u666F\u3002\n\n\u4E32\u9023\u7DA0\u5730\u3002\n\n\u7167\u9867\u65E2\u6709\u6A39\u3002\n\n\u5148\u7167\u9867\u6A39\uFF0C\u518D\u76E4\u9EDE\u7A7A\u9593\uFF0C\u5019\u9078\u6A1F\u6A39\u8207\u6708\u6A58\u3002", plants: [{ name: "\u6A1F\u6A39", scientificName: "Cinnamomum camphora" }, { name: "\u6708\u6A58" }], vision: true };
const home = { answer: "\u660E\u4EAE\u967D\u53F0\u53EF\u8003\u616E\u6708\u6A58\u3002\n\n\u5BA4\u5167\u64FA\u98FE\u53EF\u8003\u616E\u9EC3\u91D1\u845B\uFF0C\u907F\u514D\u4EBA\u5BF5\u8AA4\u98DF\u3002", plants: [{ name: "\u6708\u6A58" }, { name: "\u9EC3\u91D1\u845B" }], vision: false };
const sources = [{ title: "\u516C\u958B\u4F86\u6E90", url: "https://data.gov.tw/dataset/128274" }];
function seed(db, ids = ["a", "b"]) {
  const metadata = { villageIds: ids, messages: MESSAGES }, version = hash(JSON.stringify(metadata));
  db.prepare("INSERT INTO runs VALUES(?,?,?)").run(version, JSON.stringify(metadata), "time");
  for (const id of ids) for (const mode of ["home", "planting"]) {
    const g = JSON.stringify({ ecology: { planRegionId: "north" }, description: "not-exported", imageUrl: "not-exported" });
    db.prepare("INSERT INTO jobs(version,villageId,mode,status,updatedAt,input,grounding,groundingHash) VALUES(?,?,?,'pending','time',?,?,?)").run(version, id, mode, JSON.stringify(validateRequest({ villageId: id, mode, message: MESSAGES[mode], history: [] })), g, hash(g));
  }
  return version;
}
function run(db, version, model, extra = {}) {
  return processJobs({ db, version, model, validateRequest, formatResponse, HttpError, sources, ...extra });
}
test("sequential per-village planting then home order, exact metadata, resume skips success, stable safe export", async () => {
  const db = openDatabase(":memory:"), v = seed(db), order = [];
  let active = 0;
  await run(db, v, async (input) => {
    assert.equal(active++, 0);
    order.push(input.mode + ":" + input.villageId);
    await Promise.resolve();
    active--;
    return input.mode === "planting" ? planting : home;
  });
  assert.deepEqual(order, ["planting:a", "home:a", "planting:b", "home:b"]);
  await run(db, v, () => assert.fail("completed request repeated"));
  const exported = safeExport(db, v);
  assert.equal(exported.jobs.length, 4);
  assert.equal(exported.jobs.find((j) => j.mode === "planting").plants[0].scientificName, "Cinnamomum camphora");
  assert.equal(exported.jobs.find((j) => j.mode === "planting").tour.kind, "four-region-vision");
  assert.equal(exported.jobs.find((j) => j.mode === "home").tour, void 0);
  assert.equal(JSON.stringify(exported), JSON.stringify(safeExport(db, v)));
  assert.doesNotMatch(JSON.stringify(exported), /not-exported|imageUrl|description/);
  db.close();
});
test("clear 429/503 only: two retries, bounded Retry-After, wrapped502 never retries", async () => {
  for (const status of [429, 503, 502]) {
    const db = openDatabase(":memory:"), v = seed(db, ["a"]), wait = [];
    let calls = 0;
    await run(db, v, () => {
      calls++;
      throw new HttpError(status, "secret-provider-raw", 99999);
    }, { limit: 1, sleep: async (ms) => wait.push(ms) });
    assert.equal(calls, status === 502 ? 1 : 3);
    assert.deepEqual(wait, status === 502 ? [] : [36e5, 36e5]);
    assert.doesNotMatch(JSON.stringify(db.prepare("SELECT * FROM attempts").all()), /secret-provider/);
    db.close();
  }
});
test("Retry-After succeeds, validation failures continue without repair", async () => {
  const db = openDatabase(":memory:"), v = seed(db, ["a"]), wait = [];
  let calls = 0;
  await run(db, v, (input) => {
    calls++;
    if (calls === 1) throw new HttpError(429, "busy", 7);
    return input.mode === "planting" ? { ...planting, answer: "bad" } : home;
  }, { sleep: async (ms) => wait.push(ms) });
  assert.equal(calls, 3);
  assert.deepEqual(wait, [7e3]);
  const rows = db.prepare("SELECT mode,status,errorCode FROM jobs ORDER BY mode").all();
  assert.equal(rows[0].status, "success");
  assert.equal(rows[1].errorCode, "validation-paragraphs");
  db.close();
});
test("interrupted inflight becomes uncertain error; only explicit reset retries", async () => {
  const db = openDatabase(":memory:"), v = seed(db, ["a"]);
  db.prepare("UPDATE jobs SET status='inflight',attempts=1 WHERE mode='planting'").run();
  db.prepare("INSERT INTO attempts VALUES(?,'a','planting',1,'time',NULL,'inflight')").run(v);
  recoverInflight(db, v);
  assert.equal(db.prepare("SELECT errorCode FROM jobs WHERE mode='planting'").get().errorCode, "uncertain-interrupted");
  let calls = 0;
  await run(db, v, () => {
    calls++;
    return home;
  });
  assert.equal(calls, 1);
  db.prepare("UPDATE jobs SET status='pending' WHERE status='error'").run();
  await run(db, v, () => {
    calls++;
    return planting;
  });
  assert.equal(calls, 2);
  db.close();
});
test("blank lines, duplicate names, candidate metadata, grouped home and no inviting endings", () => {
  for (const [value, mode] of [[planting, "planting"], [home, "home"]]) assert.equal(validateBatchAnswer(value, mode), value);
  for (const [value, mode] of [[{ ...planting, answer: planting.answer.replaceAll("\n\n", "\n") }, "planting"], [{ ...planting, plants: [{ name: "\u6A1F\u6A39" }, { name: "\u6A1F\u6A39" }] }, "planting"], [{ ...home, answer: home.answer + "\u4F60\u5BB6\u5462\uFF1F" }, "home"], [{ ...home, plants: [{ name: "\u6708\u6A58" }, { name: "\u4E0D\u5B58\u5728" }] }, "home"], [{ ...home, vision: true }, "home"]]) assert.throws(() => validateBatchAnswer(value, mode));
});
test("fetch wrapper preserves explicit503 without exposing body; real model wraps generic failure502", async () => {
  let cancelled = false;
  const wrapped = preservingFetch(async () => ({ status: 503, headers: new Headers({ "retry-after": "5" }), body: { cancel: async () => {
    cancelled = true;
  } } }), HttpError, boundedRetryAfter);
  await assert.rejects(wrapped(), (e) => e.status === 503 && e.retryAfter === 5);
  assert.ok(cancelled);
  const { createModelClient } = await import("../server/plant-advice-model.mjs");
  const client = createModelClient({ authLoader: async () => "mock-token", fetcher: preservingFetch(async () => new Response("private", { status: 503, headers: { "retry-after": "3" } }), HttpError, boundedRetryAfter) });
  await assert.rejects(client({ history: [], mode: "home", message: "x" }, {}, new AbortController().signal), (e) => e.status === 503);
  const bad = createModelClient({ authLoader: async () => "mock-token", fetcher: async () => new Response("private", { status: 502 }) });
  await assert.rejects(bad({ history: [], mode: "home", message: "x" }, {}, new AbortController().signal), (e) => e.status === 502);
});
test("filesystem lock excludes another owner and releases only owned token", async () => {
  const dir = await mkdtemp(join(tmpdir(), "advice-test-"));
  try {
    const release = await acquireLock(dir);
    await assert.rejects(acquireLock(dir), /already running/);
    assert.equal(JSON.parse(await readFile(join(dir, "process.lock"))).pid, process.pid);
    await release();
    const next = await acquireLock(dir);
    await next();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("SQLite transaction rollback, persisted restart, full456 coverage and tamper checks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "advice-db-"));
  try {
    const path = join(dir, "test.sqlite");
    let db = openDatabase(path);
    const v = seed(db, Array.from({ length: 456 }, (_, i) => "v" + i));
    assert.throws(() => transaction(db, () => {
      db.prepare("UPDATE jobs SET status='error'").run();
      throw Error("rollback");
    }));
    assert.equal(verifyDatabase(db, v).counts.pending, 912);
    db.close();
    db = openDatabase(path);
    assert.equal(verifyDatabase(db, v).expected, 912);
    db.prepare("UPDATE jobs SET grounding='{}' WHERE villageId='v0'").run();
    assert.throws(() => verifyDatabase(db, v), /Grounding integrity/);
    db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("retry cooldown and budget survive interruption without repaying uncertain inference", async () => {
  const db = openDatabase(":memory:"), v = seed(db, ["a"]), controller = new AbortController();
  let calls = 0;
  await run(db, v, () => {
    calls++;
    throw new HttpError(429, "busy", 7);
  }, { limit: 1, signal: controller.signal, sleep: async () => {
    controller.abort();
    throw Error("aborted");
  } });
  const first = db.prepare("SELECT * FROM jobs WHERE mode='planting'").get();
  assert.equal(first.status, "pending");
  assert.equal(first.retryCount, 1);
  assert.ok(Date.parse(first.notBefore) > Date.now());
  const waits = [];
  await run(db, v, () => {
    calls++;
    throw new HttpError(429, "busy", 7);
  }, { limit: 1, sleep: async (ms) => waits.push(ms) });
  assert.equal(calls, 3);
  assert.equal(waits.length, 2);
  assert.equal(db.prepare("SELECT status FROM jobs WHERE mode='planting'").get().status, "error");
  db.close();
});
