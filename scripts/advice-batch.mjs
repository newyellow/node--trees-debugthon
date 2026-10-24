#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile, mkdir, mkdtemp, rm, writeFile, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MESSAGES, hash, openDatabase, transaction, acquireLock, recoverInflight, processJobs, preservingFetch, safeExport, verifyDatabase } from "./advice-batch-core.mjs";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = resolve(homedir(), "Library/Application Support/TreesDebugthon/advice-batches");
function git(...args2) {
  return execFileSync("git", ["-C", ROOT, ...args2], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
}
async function freezeSource(source, base = BASE) {
  const sha = git("rev-parse", "--verify", source + "^{commit}");
  const initial = ["package.json", "scripts/advice-batch.mjs", "scripts/advice-batch-core.mjs", "server/plant-advice-model.mjs", "server/plant-advice-grounding.mjs", "server/plant-advice-validation.mjs"];
  const paths = new Set(initial), queue = [...initial.filter((p) => p.endsWith(".mjs"))];
  for (const p of queue) {
    const bytes = git("show", sha + ":" + p);
    if (/import\s*\(/.test(bytes) && !p.startsWith("scripts/")) throw Error("Dynamic runtime imports require explicit snapshot support");
    for (const m of bytes.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      if (m[1].startsWith("node:")) continue;
      if (!m[1].startsWith(".")) throw Error("External dependency requires explicit snapshot support");
      const dep = resolve("/", dirname(p), m[1]).slice(1);
      if (!paths.has(dep)) {
        paths.add(dep);
        queue.push(dep);
      }
    }
  }
  const data = ["public/data/village-game.json", "public/data/social-metrics.json", "public/data/plant-advice-knowledge.json", "public/data/mountain-ecology-knowledge.json", "public/data/street-tree-planning-knowledge.json", "public/data/village-trees/manifest.json"];
  const manifest = JSON.parse(git("show", sha + ":public/data/village-trees/manifest.json"));
  for (const v of Object.values(manifest.villages)) {
    if (!/^villages\/[A-Za-z0-9_-]+\.json$/.test(v.file)) throw Error("Unsafe manifest path");
    data.push("public/data/village-trees/" + v.file);
  }
  for (const p of data) paths.add(p);
  const files = [...paths].sort();
  for (const p of initial.filter((p2) => p2.startsWith("scripts/"))) if (hash(await readFile(resolve(ROOT, p))) !== hash(execFileSync("git", ["-C", ROOT, "show", sha + ":" + p]))) throw Error("Commit batch tooling before run; source must match runner");
  await mkdir(base, { recursive: true, mode: 448 });
  const temp = await mkdtemp(resolve(base, ".freeze-"));
  try {
    const archive = resolve(temp, "source.tar"), root = resolve(temp, "root");
    await mkdir(root);
    execFileSync("git", ["-C", ROOT, "archive", "--format=tar", "-o", archive, sha, "--", ...files]);
    execFileSync("tar", ["-xf", archive, "-C", root]);
    const hashes = {};
    for (const p of files) hashes[p] = hash(await readFile(resolve(root, p)));
    const contentHash = hash(JSON.stringify(hashes)), dest = resolve(base, "sources", sha + "-" + contentHash);
    await mkdir(dirname(dest), { recursive: true });
    try {
      await rename(root, dest);
    } catch (e) {
      if (!["EEXIST", "ENOTEMPTY"].includes(e.code)) throw e;
    }
    for (const p of files) if (hash(await readFile(resolve(dest, p))) !== hashes[p]) throw Error("Frozen snapshot modified");
    return { root: dest, sourceSha: sha, fileHashes: hashes, dataHash: hash(JSON.stringify(Object.fromEntries(data.sort().map((p) => [p, hashes[p]])))) };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
function args(argv) {
  const command = argv.shift();
  if (!["run", "status", "export", "verify"].includes(command)) throw Error("Usage: advice-batch.mjs run|status|export|verify [--source SHA --model-identity ID --version HASH --retry-errors --limit N --output FILE --prepare-only]");
  const a = { command };
  while (argv.length) {
    const k = argv.shift();
    if (["--retry-errors", "--prepare-only"].includes(k)) a[k.slice(2)] = true;
    else if (["--source", "--model-identity", "--version", "--limit", "--output"].includes(k)) {
      if (!argv[0] || argv[0].startsWith("--")) throw Error("Missing argument");
      a[k.slice(2)] = argv.shift();
    } else throw Error("Unknown option");
  }
  if (a.version && !/^[a-f0-9]{64}$/.test(a.version)) throw Error("Invalid version");
  if (a.limit && (!/^\d+$/.test(a.limit) || Number(a.limit) < 1)) throw Error("Invalid limit");
  return a;
}
async function main(argv = process.argv.slice(2)) {
  process.umask(63);
  const a = args([...argv]);
  const release = await acquireLock(BASE);
  let db;
  try {
    db = openDatabase(resolve(BASE, "batches.sqlite"));
    let version = a.version;
    if (a.command === "run") {
      if (!/^[a-f0-9]{40}$/.test(a.source || "") || !a["model-identity"] || a["model-identity"].length > 200 || /[\r\n]/.test(a["model-identity"])) throw Error("Run requires explicit --source committed SHA and --model-identity (verified configured identity, not a credential)");
      const frozen = await freezeSource(a.source);
      const mod = async (p) => import(pathToFileURL(resolve(frozen.root, p)).href);
      const [{ loadGrounding }, { createModelClient, SYSTEM_PROMPT }, validation] = await Promise.all([mod("server/plant-advice-grounding.mjs"), mod("server/plant-advice-model.mjs"), mod("server/plant-advice-validation.mjs")]);
      const grounding = await loadGrounding({ root: resolve(frozen.root, "public") });
      const manifest = JSON.parse(await readFile(resolve(frozen.root, "public/data/village-trees/manifest.json")));
      const villageIds = Object.keys(manifest.villages).sort();
      if (villageIds.length !== 456) throw Error("Expected 456 villages");
      const metadata = { schemaVersion: 1, sourceSha: frozen.sourceSha, model: { alias: "openclaw/trees-plant-advisor", identity: a["model-identity"], identitySource: "operator-verified-config", endpoint: "http://127.0.0.1:18789/v1/chat/completions" }, promptHash: hash(SYSTEM_PROMPT), inputHash: hash(JSON.stringify(MESSAGES)), dataHash: frozen.dataHash, fileHashes: frozen.fileHashes, villageIds, messages: MESSAGES };
      const derived = hash(JSON.stringify(metadata));
      if (version && version !== derived) throw Error("Version/source/model mismatch");
      version = derived;
      if (!db.prepare("SELECT version FROM runs WHERE version=?").get(version)) {
        const rows = [];
        for (const villageId of villageIds) {
          const g = JSON.stringify(await grounding.get(villageId));
          for (const mode of ["planting", "home"]) rows.push({ villageId, mode, input: JSON.stringify(validation.validateRequest({ villageId, mode, message: MESSAGES[mode], history: [] })), g });
        }
        transaction(db, () => {
          db.prepare("INSERT INTO runs VALUES(?,?,?)").run(version, JSON.stringify(metadata), (/* @__PURE__ */ new Date()).toISOString());
          const q = db.prepare("INSERT INTO jobs(version,villageId,mode,status,updatedAt,input,grounding,groundingHash) VALUES(?,?,?,'pending',?,?,?,?)");
          for (const r of rows) q.run(version, r.villageId, r.mode, (/* @__PURE__ */ new Date()).toISOString(), r.input, r.g, hash(r.g));
        });
      }
      verifyDatabase(db, version);
      recoverInflight(db, version);
      if (a["retry-errors"]) transaction(db, () => db.prepare("UPDATE jobs SET status='pending',errorCode=NULL,retryCount=0,notBefore=NULL WHERE version=? AND status='error'").run(version));
      console.log(JSON.stringify({ version, sourceSha: frozen.sourceSha, prepared: true }));
      if (!a["prepare-only"]) {
        const controller = new AbortController();
        const stop = () => controller.abort();
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
        try {
          const model = createModelClient({ fetcher: preservingFetch(globalThis.fetch, validation.HttpError, validation.boundedRetryAfter) });
          await processJobs({ db, version, model, ...validation, sources: grounding.sources, signal: controller.signal, limit: a.limit ? Number(a.limit) : Infinity, onProgress: (p) => console.log(JSON.stringify({ version, ...p })) });
        } finally {
          process.removeListener("SIGINT", stop);
          process.removeListener("SIGTERM", stop);
        }
      }
    }
    if (!version) {
      const runs = db.prepare("SELECT version,createdAt FROM runs ORDER BY createdAt").all();
      console.log(JSON.stringify({ runs }));
      return;
    }
    if (a.command === "export") {
      if (!a.output) throw Error("Export requires --output");
      verifyDatabase(db, version);
      const out = resolve(a.output), temp = out + "." + process.pid + ".tmp";
      await writeFile(temp, JSON.stringify(safeExport(db, version), null, 2) + "\n", { flag: "wx", mode: 384 });
      await rename(temp, out);
      console.log(JSON.stringify({ version, output: out }));
    } else {
      const result = verifyDatabase(db, version);
      console.log(JSON.stringify({ version, ...result }));
      if (a.command === "verify" && !result.complete) process.exitCode = 2;
    }
  } finally {
    db?.close();
    await release();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  console.error(JSON.stringify({ error: "Batch command failed; inspect flags, committed snapshot, lock ownership, and status. No raw provider error is logged." }));
  process.exitCode = 1;
});
export {
  freezeSource,
  main
};
