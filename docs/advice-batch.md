# Resumable advice batches (Node 24)

This operator-only tool does not modify the UI, live server, or configuration. It uses a dedicated createModelClient directly, not the public advice endpoint and never an image API. There is exactly one request in flight: each village planting then home, village IDs sorted deterministically. Validation errors are recorded and processing continues; no paid repair requests.

## Before any inference

The integrator must commit these tools and the intended public grounding/data updates first. Choose that immutable commit SHA. Run refuses a source whose committed batch scripts differ from the executing scripts. Uncommitted server/data changes are deliberately ignored, not mixed into the batch.

The configured advisor alias is openclaw/trees-plant-advisor. The operator must verify its underlying model identity and pass that non-secret identity with --model-identity. Metadata records this as operator-verified configuration, not provider-attested model provenance; do not silently repoint the alias during a run. Credentials are read only by the existing model client from its permission-checked runtime auth file. Never put a credential in command arguments.

Runtime files are private (umask 077) beneath:

    ~/Library/Application Support/TreesDebugthon/advice-batches/
      batches.sqlite             # SQLite WAL, synchronous FULL
      process.lock               # exclusive owner PID/hostname/token
      sources/<SHA>-<hash>/       # committed git archive; no working-tree modules

The archive includes the entire relative module dependency closure, package.json, the five grounding JSON inputs and every manifest-referenced village shard. Every file's full bytes are hashed. Local modules are imported only from that archive, including the system prompt, ecology, social metrics, request validation and response formatter. Initial user messages are fixed in the committed batch core (never UI imports). All 456 villages are grounded and request-validated before the first inference. The full per-job input/grounding, grounding hashes, source SHA, prompt/input/data/file hashes, model identity, attempts and timestamps are persisted. Version is SHA-256 of deterministic metadata including source SHA and all dependency/data hashes; changing either source commit or model identity creates a distinct version.

## Commands

From the repository root, after the integrator's commit:

    NODE='/Users/piyellow/Library/Application Support/TreesDebugthon/node-v24.22.1-darwin-arm64/bin/node'
    SOURCE=$(git rev-parse HEAD)
    MODEL='REPLACE_WITH_VERIFIED_CONFIGURED_MODEL_IDENTITY'
    "$NODE" --test tests/advice-batch.test.mjs
    "$NODE" scripts/advice-batch.mjs run --source "$SOURCE" --model-identity "$MODEL" --prepare-only

Save the printed 64-character version as VERSION. Preparation makes no model calls. Then explicitly start the paid batch:

    VERSION='REPLACE_WITH_PREPARED_VERSION'
    "$NODE" scripts/advice-batch.mjs run --source "$SOURCE" --model-identity "$MODEL" --version "$VERSION"

The same command resumes only pending jobs; successful and errored jobs are skipped. Optional --limit N stops after N jobs (not N HTTP attempts). Interrupt with SIGINT/SIGTERM; an active request is aborted and conservatively recorded as an error. A hard interruption leaves inflight, which the next run marks uncertain-interrupted, never automatically paid again.

    "$NODE" scripts/advice-batch.mjs status
    "$NODE" scripts/advice-batch.mjs status --version "$VERSION"
    "$NODE" scripts/advice-batch.mjs verify --version "$VERSION"
    "$NODE" scripts/advice-batch.mjs export --version "$VERSION" --output /absolute/path/advice.json

Status without version lists available runs. Verify exits 0 only for complete 912/912 successful coverage, 2 for a healthy but incomplete run, and 1 for invalid usage/integrity failure. Status reports incomplete coverage without a failing exit. Export allows healthy partial results, includes status/error codes, and never presents an error as success. It atomically writes a stable JSON projection ordered by village/mode. It includes validated answer (blank lines preserved), exact plant names/scientificName when provided, source citations, region ID and optional four-region future tour payload. It excludes grounding bodies, raw provider output, image URLs/binaries, Flora descriptions and credentials. This is a future consumption artifact, not a frontend cache integration.

Only after reviewing errors and accepting possible duplicate billing:

    "$NODE" scripts/advice-batch.mjs run --source "$SOURCE" --model-identity "$MODEL" --version "$VERSION" --retry-errors

--retry-errors resets all errors, including uncertain and validation errors, to pending; it does not alter successful jobs. This is an explicit paid retry, not an automatic repair.

## Retry, locking, validation

Only a clear upstream HTTP 429 or 503 rejection is automatically retried, at most twice per job (the budget and Retry-After deadline survive interruption/resume; explicit --retry-errors starts a new budget). Retry-After is bounded to 1–3600 seconds (default 60). The batch-only fetch wrapper preserves 503 with the existing HttpError class; it does not modify live server modules. Wrapped 502s, transport failures, timeouts, interrupted streams and invalid output are uncertain/non-retryable. HTTP 503 is treated as a pre-inference rejection; if a gateway can return 503 after performing inference, disable that upstream behavior before running. Never infer billing certainty from a generic 502.

One filesystem lock covers run/status/export/verify. The exclusive lock contains PID, hostname and random owner token, and only the owner releases it. A stale/unverifiable lock is fail-closed: after independently verifying the recorded process is gone, the operator may remove only process.lock. Do not remove a live owner's lock. Resume then records leftover inflight as uncertain. Concurrent commands intentionally fail rather than race SQLite writes.

Existing validateRequest, validateModelOutput and formatResponse contracts are reused. Additional checks enforce four planting paragraphs separated by blank lines, 2–4 unique metadata names present verbatim in the answer (and final planting paragraph), home balcony/indoor groups with 1–2 named candidates each, home vision=false, and common trailing questions/chat invitations. These are structural guardrails, not complete botanical or linguistic verification; exact candidate completeness beyond supplied metadata and factual quality still require editorial audit. Scientific names are retained only when supplied, never guessed. SQLite integrity/foreign-key checks, exact 456×2 coverage, metadata version hash, request copies and grounding hashes are verified before resume/export. No provider text/error bodies are logged.

Tests use temporary SQLite files and mocked inference/fetch only; no live service or credential access. An initial committed-archive --prepare-only smoke check must be done by the integrator after commit; it cannot legitimately run before these scripts exist in that commit.
