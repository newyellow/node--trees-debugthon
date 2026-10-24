# Existing-version bounded parallel resume

This separate runner resumes ONLY version 4577aeaa30f65e6052df3bc5d9aef737f3d8f7cc9f5eeb82df5982800c70efab, source bb7d46631d9628a81ab99111e0123768eeba8274. It never freezes new source, changes metadata, prepares new jobs, resets errors, or reclaims inflight jobs. Frozen files need not match this new scheduler. All recorded files/full SHA-256 hashes, relative dependency closure, source path, prompt hash, and verifyDatabase are checked before inference. Model/validation/formatting/grounding modules are imported from that verified frozen root; stored input and grounding bodies are reused exactly. Existing core supplies locking, SQLite, transaction, answer validation and preservingFetch helpers.

## Operator commands (after old owner exited)

    NODE='/Users/piyellow/Library/Application Support/TreesDebugthon/node-v24.22.1-darwin-arm64/bin/node'
    VERSION='4577aeaa30f65e6052df3bc5d9aef737f3d8f7cc9f5eeb82df5982800c70efab'
    "$NODE" --test tests/advice-batch-parallel.test.mjs tests/advice-batch.test.mjs
    "$NODE" scripts/advice-batch-parallel.mjs --version "$VERSION" --concurrency 3 --prepare-only
    "$NODE" scripts/advice-batch-parallel.mjs --version "$VERSION" --concurrency 3

Optional --limit N counts distinct jobs selected this invocation, including their permitted retries; not HTTP attempts. --stop-file /absolute/path drains when that file exists (checks at scheduler loop/progress boundaries, polling cooldown every <=250ms). SIGINT/SIGTERM stop claims and drain active calls; signals do NOT abort model requests. The frozen client's 45-second timeout remains. Repeated signals still drain. No second runner can own process.lock. Prepare-only acquires/releases that same lock, validates, and makes no model/auth calls, recovers nothing, and changes no job/run records (opening existing SQLite can perform normal WAL/PRAGMA bookkeeping).

Never delete a live lock. If startup finds inflight, it refuses inference unless --confirm-old-owner-dead is explicitly supplied AFTER independently verifying the former owner is gone. Recovery then marks inflight uncertain-interrupted/error, never pending; errors need a separate explicit operator decision, not this runner. Prepare-only can validate inflight without recovering it.

## Scheduling and retries

One Node process/SQLite connection atomically claims pending jobs and inserts attempts in BEGIN IMMEDIATE; terminal writes compare status plus exact attempt and roll back on conflict. Claim selection is villageId ascending, planting before home; each home's planting must already be terminal success/error. Across villages completion order naturally differs. Other inflight work is never reclaimed.

At most three active calls. Progress logs counts only: processed, selected, actual inflight, highwater, requestedConcurrency, current concurrency, draining. No raw output/provider text/credentials. Only clear HttpError 429/503 gets at most two retries, consuming existing retryCount; notBefore survives drain/restart. Any rejection immediately downshifts globally to one, never auto-upshifts; already inflight calls finish. No new claims occur until the maximum Retry-After deadline expires. Downshift is conservatively restored on restart if any historical rejection attempt exists. Terminal exhausted rejection retains its notBefore too, so global cooldown survives restart without schema/metadata changes. HTTP 503 must truly mean pre-inference rejection; uncertain 502/transport/timeouts/invalid answers never retry.

## Old sequential runner transition caveat

The old runner aborts active calls on signals; do not use a signal for zero-abort transition. Parent/operator separately mock-verified a temporary, version-scoped SQLite BEFORE UPDATE OF status trigger that raises ABORT only on pending -> inflight. That permits an existing completion, then rolls back its next claim and lets old CLI finally release its lock. Only the operator/integrator owns this exceptional transition: backup first; scope trigger to exact version/state; wait for old PID exit and no inflight; backup/verify; DROP that trigger before new prepare/run. Leaving it installed prevents this runner from claiming. This runner never installs/removes transition triggers or auto-removes locks. No production transition or live inference was performed by its implementation tests.

Integrity hashes protect a trusted private snapshot, not hostile concurrent filesystem mutation after verification. Keep source snapshots/operator account access controlled. Actual configured model identity remains the original operator-verified metadata, not a fresh provider attestation.
