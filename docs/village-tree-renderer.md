# Unclustered village-managed-tree preview

## Public API


Create an instance with `createVillageTrees({ map, base, statusHost, onFeatureOpen, onState, expectedSnapshot, expectedSourceHashes })` from `src/workspaces/02/village-trees.js` (it imports its own CSS).

- `await show(villageId, { preview: boolean })` lazily loads metadata and exactly one village shard. Returns the validated ready state, or null on failure/cancellation. Network/validation errors update visible status and retry button; they do not reject this promise. Rendering is cooperative and may finish after the promise: wait for statusHost `data-phase="ready"` and canvas `data-rendered-count` equal to count.
- `clear()` invalidates pending requests and batched rendering, empties the canvas and closes its own popup, but keeps the bounded data cache.
- `destroy()` removes listeners, renderer, group, dedicated pane, and owned status nodes; idempotent.
- `containsEvent(mouseEvent): boolean` and `hitTestLayerPoint(leafletPoint): boolean` let previously registered lower-pane capture listeners defer to this z470 layer. No global event handlers are installed.
- `onState({phase,villageId,preview,records,count,...})` fires loading/ready/error/clear. Loading clears old canvas synchronously and passes an empty records array; ready passes the original validated shard records by reference, **read-only by contract**. Parent may exclude exact layerId + String(treeId) identities from enabled checkbox rendering; never suppress a complete source layer or unrelated records. No copied source arrays are created.
- `onFeatureOpen({villageId,record})` runs before the safe source popup opens, including overlap-list selection. Parent may pin that hover village and close HUD/panels, but must NOT clear/reset trees here.

Parent owns hover debounce (~180–200ms), pinned selection, hideHover behavior, restoration of pinned trees on polygon exit, and explicit clear action. Canvas and pane are pointer-events:none: the polygon remains the native hover target, including while the pointer crosses tree dots. Do not clear on a tree click callback or panel-close side effects. Empty map space, wheel, and dragging continue to reach normal map/polygon handlers. Parent also owns all seven original checkbox states; this module does not edit them.

## Data contract

Base URL is the app prefix, e.g. `/02/`. Requests go to `base + data/village-trees/manifest.json`; every shard file is relative to that manifest directory (not app root).

Manifest schemaVersion=1, treeSnapshot string, sourceHashes containing street-trees.geojson and park-trees.geojson SHA-256 (layer-ID aliases also accepted), villages keyed by ID. Each value has id/district/name/file/count/sha256/byLayer, with explicit nonnegative integer street-trees and park-trees counts that sum to count. expectedSnapshot compares exact strings. expectedSourceHashes can be village-game.inputHashes: every caller-supplied source/boundary/manifest hash is required and must match; no required hash may be omitted.

Shard schemaVersion=1, villageId, treeSnapshot, records. Each record has layerId, treeId, sourceIndex, feature (full untouched original GeoJSON Point Feature). Exact total and per-source counts, layer, unique layer+TreeID, unique layer+sourceIndex, strictly string-valued original properties.TreeID identity, finite world-valid point coordinates, schema, village and snapshot are checked. SHA-256 is computed over original response bytes before JSON validation. Invalid input fails explicitly, never partially renders or silently drops points. Zero-count shards are real zero, not placeholders.

Manifest fetch and per-ID in-flight requests are deduplicated. Successful shard data uses an LRU of at most eight villages. Failed promises are evicted so explicit retry works; raw record/feature references persist on cache hits. Every show/clear/destroy advances request generation, so a late hover/cross-village result cannot resurrect old selection. Rendering has a separate cancellation token and yields every 400 records; no sampling, point cap, grid grouping, clustering, zoom threshold, or feature filtering is used.

## Canvas and source details

Dedicated z470 pane sits above village polygons and existing record panes 450/460, below standard popup pane 700. One L.circleMarker per record, one Canvas renderer. Per-record hit testing runs only on the map container's click capture; only actual nearby points intercept. Existing lower-pane capture listeners must early-return when containsEvent(event) is true. Moving onto canvas dots cannot create synthetic polygon mouseout because the canvas never participates in pointer hit targets.

A single keyboard-focusable canvas supports direction keys to navigate every record and Enter/Space to open. It updates accessible label and dataset tree/layer IDs and pans if a selected point is outside map bounds. No per-tree DOM paths are inserted. Exact same-coordinate records have an uncapped selection list in the popup, with source-layer + TreeID identities, including cross-source overlaps. Popup is constructed with textContent; all original non-helper property fields, nested values, TreeID, source snapshot/hash/index and original WGS84 coordinates are visible. Underscore-prefixed derived helper fields remain untouched in raw data but are not presented as source fields.

Stable selectors:
- `canvas[data-village-trees][data-village-id][data-rendered-count]`
- selected keyboard identity `canvas[data-tree-id][data-layer-id]`
- `.village-tree-popup[data-village-id][data-tree-id][data-layer-id]`
- `.village-tree-overlap-list button[data-tree-id][data-layer-id]`
- statusHost `data-phase` loading/rendering/ready/error/clear and `data-count`

## Verification

Verified the generated production-shaped manifest and all 456 shards against village-game.treeSnapshot/inputHashes: 162,321 assigned records, maximum 6,389 records in one village, LRU retained 8 villages. Pure tests: 9 passed with bundled Bun test runner. No build, commit, or deployment was performed by this module worker.

`tests/village-tree-loader.test.mjs`: lazy loading; in-flight dedup; late hover/click/clear/destroy races; cache pointer preservation and eight-village eviction; network/error/retry; manifest retry and shard-byte SHA-256; schema/snapshot/hash/path/count validation; source identity/duplicate/index/coordinates; 160,001 uncapped records and overlap lookup; true zero; separate canvas/capture contract. Browser integration is parent-owned: verify actual village shard completion counts, clicking actual pixels, overlap popup, keyboard, empty village space, pan/wheel, checkbox exclusion and hover continuity.

Parent review tightened all supplied source-hash checks, preserved hover-to-pin popup state, constrained mobile popup width, hid the status card while reading tree fields, and moved detailed provenance to a native disclosure after raw fields. Browser acceptance verifies all6389 records in the largest village, exact original fields, real-pointer and keyboard query, zero-village and503retry, late hover cancellation, checkbox preservation/exclusion, mobile scroll containment and no mapping/full-city download.
