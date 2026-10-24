# Persisted village tree records (schema 1)

## Choice and scope

This is an offline, persisted static JSON database: one manifest, 456 village shards (including empty villages), an unmatched shard, and an identity mapping. SQLite is optional for future ad-hoc analysis, not required for static hosting or browser lookup. The browser can fetch just the manifest and the hovered/clicked village shard instead of loading a database or all 162,369 features.

Only managed street trees and park trees are included. Protected trees remain a separate special dataset and MUST NOT be added to the managed-tree count. This preparation does not change any existing snapshot, score, seven checkbox layers, UI, or routes. It does not cluster, sample, cap records at 100, invent locations, or remove raw fields.

## API

Base URL: /data/village-trees/ (all manifest file paths are relative to this base).

- manifest.json: {schemaVersion:1, treeSnapshot, sourceHashes, layers, boundary, assignment, audit, total, assigned, villages, unmatched, mapping}.
- sourceHashes keys: manifest.json, regions.json, street-trees.geojson, park-trees.geojson, village-game.json. SHA-256 hashes are exact original bytes, including ordering/whitespace. The first four MUST equal village-game.json inputHashes before generation proceeds.
- layers: original managed-layer metadata, source URLs, update dates and CRS; each also carries source SHA-256 and license URL. boundary retains source/download/fetchedAt and hash.
- villages[id]: {id,district,name,file,count,sha256,bytes,byLayer:{"street-trees":number,"park-trees":number}}.
- unmatched and mapping: {file,count,sha256,bytes}.
- villages/<id>.json: {schemaVersion:1,villageId,treeSnapshot,records:[{layerId,treeId,sourceIndex,feature}]}.
- unmatched.json: same raw-record shape, villageId:null.
- mapping.json: {schemaVersion:1,treeSnapshot,identity:["layerId","TreeID"],records:[{layerId,TreeID,villageId,sourceIndex}]}.

The stable identity is (layerId, original properties.TreeID), NOT sourceIndex. Mapping deliberately uses the original spelling TreeID; raw shard wrappers use treeId. sourceIndex is zero-based source-array provenance only. Every feature is the original full parsed GeoJSON feature, preserving all geometry coordinates, properties, bbox, values, types and nulls. JSON serialization is compact; source text formatting is not duplicated per feature. Shards contain source-ordered street records followed by source-ordered park records. No UI identity should depend on sourceIndex.

For hover/click, look up villages[id], request its file, verify hash and snapshot if needed, then render every record with its own real geometry. Keep ordinary checkbox controls independent; suppress exact source/TreeID duplicates only while the raw village layer is visible. No mapping.json fetch is necessary for normal village browsing; it is a 15 MB audit/export resource. Network errors should remain distinguishable from a valid zero-tree village.

## Spatial and identity audit

The generator uses the existing shared toMeters (EPSG:3826/TWD97), mapGeometry and containsPoint, indexed with RBush using original longitude/latitude bboxes. Holes and multipolygons are retained; outer and hole boundaries are included. When more than one original region contains a point, lowest original regions.features index wins. Each membership is recomputed from geometry and compared against the old positional array. All layer TreeIDs must be nonempty strings and unique within that layer. Reordered equal-length sources fail the exact-byte hash gate before membership is used.

Counts reconcile per village with village-game.json and per layer with its original treeAudit:

| Layer | Total | Assigned | Unmatched |
|---|---:|---:|---:|
| street-trees | 90,358 | 90,337 | 21 |
| park-trees | 72,011 | 71,984 | 27 |
| Total | 162,369 | 162,321 | 48 |

Unmatched points remain unmatched, not nearest-village assignments.

## Offline reproduction and tests

Run with Node (ES modules), with normal package dependencies installed:

    node scripts/prepare-village-trees.mjs
    node --test tests/village-tree-data.test.mjs

On the current paired Mac, Node is not on PATH; verified execution used:

    /Applications/OpenClaw.app/Contents/Resources/runtime/bin/bun scripts/prepare-village-trees.mjs
    /Applications/OpenClaw.app/Contents/Resources/runtime/bin/bun test tests/village-tree-data.test.mjs

No network, ignored test-results cache, new timestamps or source refreshes are used. All inputs are tracked public/data snapshots. All validations finish before writes; generated files are staged in a temporary directory, promoted by atomic individual renames, and the manifest is promoted last. This is NOT a whole-directory transaction: concurrent refresh readers should verify hashes and retry on mismatch. Stage cleanup runs even on failure. A repeat run produced the same manifest and every referenced file hash. Deploy the finished directory as one release, not while generating.

Tests cover hole/multipolygon/boundary/overlap/tie fixtures, equal-length reordered source rejection, all source and output hashes and byte lengths, source count and layer IDs, complete original feature equality for every record, stable identity uniqueness and coverage, every actual geometric assignment, every old membership, every original village count, and source-order identity mapping. Tests need only committed snapshots and generated artifacts; ensure all 459 generated JSON files are included in the integrating commit.

## Persisted output proof

- 459 JSON files; 100,147,580 uncompressed bytes total.
- Manifest: 120,837 bytes; SHA-256 adb32bb36f6a446d40975c5f2dd3d3af268003e105506f81bf1fa61a649f1c7c.
- Village shards: 84,568,889 bytes combined; smallest 99 bytes (empty village).
- Largest village shard: 大安區龍門里 / 6300300041, 6,389 full records, 3,266,299 bytes (864 street + 5,525 park).
- Mapping: 162,369 records, 15,433,318 bytes; SHA-256 3d7e505982063c4f00e45ddd3b8063ff8709a0cc60763215c97270b97d0b9549.
- Unmatched: 48 full records, 24,536 bytes; SHA-256 ab0b9b2889f74b66ff50a8799257b92e9bd130e866779c5d341122909f625b59.

These are managed-tree records, not a census of all trees, canopy cover, or protected trees. Browser rendering/integration is separately owned and is not verified by these data tests.

Parent independent verification: the verified project Node24.22.1 runtime passed all three data tests, including all162369 original-feature equality and geometric memberships; the alternate Bun invocation is not required when the project Node path is exported.
