# Social Game 公園：里環境護照 MVP

Entry: /workspaces/02/index.html (explicit file URL; supports Vite BASE_URL).
No accounts, uploads, leaderboard, storage, total score or ecology-health claim. Map and keyboard-accessible search/list expose all 456 villages. No full tree GeoJSON is downloaded by this page. Private UI modules import Leaflet but do not import explorer startup, shared CSS or imagery cache.

## Reproduce

Use verified Node 24.22.1 in ~/Library/Application Support/TreesDebugthon/node-v24.22.1-darwin-arm64/bin (add directory to PATH). Existing node_modules may be symlinked read-only from the main checkout; no install/package mutation.

- node scripts/prepare-village-game.mjs: one bounded batch of the two official CSV resources below; only writes dedicated public/data/village-game.json (atomic temp rename), raw input cache goes under ignored test-results/village-sources/.
- --cached uses existing source files without remote I/O; fetchedAt=null deliberately does not invent a fetch date. Do not use the cached mode to imply newly refreshed data.
- npm test
- npm run build -- --outDir test-results/village-game-build
- Serve that directory using existing serve package/serve.json on loopback port5192, NOT production dist or --single.
- node scripts/check-village-game-browser.mjs (Chrome installed; deterministic tile stubs by default).
- TREES_STUB_TILES=0 node scripts/check-village-game-browser.mjs (real OSM).
- Prefix: npm run build -- --base /review/ --outDir test-results/village-game-prefix-host/review; serve its parent on5193; VILLAGE_GAME_URL=http://127.0.0.1:5193/review/workspaces/02/index.html node scripts/check-village-game-browser.mjs.

## Snapshot identity and attribution

Preparation pins manifest.fetchedAt == regions.treeSnapshot, 456 boundaries, per-layer membership lengths and unique nonempty TreeID. Every one of 162,369 point memberships is independently recomputed with existing metric projection/point-in-polygon helpers, checked against the positional index, and errors fail preparation. SHA-256 hashes of actual manifest, regions and both ordered tree GeoJSON files are recorded, not merely counts. Browser verifies exact regions bytes SHA-256, snapshot and unique village IDs before rendering. Existing snapshots are not rewritten. Region geometry stays in existing regions.json; no geometry duplicate in compact output (~300KB).

Sources / agency / license links are in output and visible UI. Government Data Open License v1: https://data.gov.tw/license . Boundary source https://data.taipei/dataset/detail?id=6b17b31d-4e16-495e-95b1-9fd1f47c80d8 ; tree agency Taipei Parks and Street Lights Office, https://data.gov.tw/dataset/128274 . Tree snapshot 2026-10-23T06:37:44.947Z; boundary retrieval 2026-10-23T09:27:27.059Z. Retrieval is not survey date.

Official Culture Bureau protected-tree CSV rid a7c2db0d-8b6e-42b2-bdcc-ae69a6797e1d, https://data.taipei/dataset/detail?id=d9d1140b-c2c3-405f-8dd1-7b87b00f6f53 . UTF-8 (BOM supported); legal register record ID used for dedup; conflicting same-ID coordinates fail. Longitude/latitude finite and within broad Taipei study bounds121.3–121.8E/24.8–25.3N then exact village spatial join. All3874 rows have valid coordinates, unique IDs and positive numeric DBH in metres;3871 assigned,3 outside. File update2026-03-23 versus metadata coverage ending2023-04-11: not a claim of current legal completeness. DBH is audited but not scored. No potential-tree designation inference.

Environmental Protection Department bins rid267d550f-c6ec-46e0-b8af-fd5a464eb098, https://data.taipei/dataset/detail?id=a835f3ba-7f50-4b0d-91a6-9df128632d1c . Big5 fatal decoding.661 raw rows:2 invalid coordinates,1 exact duplicate (trimmed address+numeric coordinate),658 unique valid/assigned,0 outside. No stable facility ID exists, so nearby bins are NOT merged by proximity. Source update date unconfirmed; exact fetch time and bytes SHA are retained. Other amenity subsets were deliberately not downloaded or summed, avoiding cross-subset duplication and expanded scope.

Managed trees: street90358=90337assigned+21unmatched; park72011=71984assigned+27unmatched. Total162369=162321assigned+48unmatched. Snapshot ID uniqueness is within each layer, not proof of physical-tree identity across layers/years. Protected counts remain a separate measure and must never be added to managed trees.

## Scores: zero-anchored-midrank-v1

Reference cohort: fixed456 Taipei villages with complete-snapshot aggregate values; same cohort under district/search filtering. These scores rank records in this snapshot, not cities or environmental merit. For positive x: round(100*(L+(E-1)/2)/(N-1)), where L=#cohort values<x and E=#equal values. Missing/nonfinite/negative values =>null/N/A. A real snapshot zero always0, including all-zero cohort. Singleton positive100, singleton zero0. All-equal positive cohort50. No total score.

1. Managed-tree record density = street+park assigned records / full village area km². Explicit proxy, NOT green coverage/canopy or all trees.
2. Protected register density = unique official assigned protected records / full area km². Independent from managed trees; not a legal decision.
3. Managed-tree NAME CATEGORY richness = count of distinct source labels, shared species.js normalization, excludes unknown and dead-status labels. Not whole flora, taxonomically reconciled species or native taxa. More sampling generally produces more labels. Raw known/all denominators, unknown/dead counts, Shannon natural-log entropy and largest-category proportion are displayed; only richness receives score. Empty known set Shannon/dominance null.
4. Native share N/A / 待分類對照. No guesses or zero substitution.
5. Bird/insect atlas N/A / 待可靠觀測資料. No absence inference or bulk observations download.
6. Convenience PROXY = clean-bin unique records / full area km². Not cleanliness, all amenities or walking access; no hours or cross-village route modeling. Raw place counts are not stalls/facility capacity.

Area-normalized measures dilute large mountain villages and are not unqualified urban-vs-mountain comparisons. Boundary ties use existing metric helper semantics (outer and hole boundaries included) then first sorted village ID; a record is assigned exactly once. Input missing, malformed or snapshot mismatch fails closed. Snapshot-zero only means no validated in-bound records in the selected source, never true field absence. Field audit suggestions confer no planting/removal/legal authority or permission to enter private land.

## Acceptance 2026-10-23

37/37 unit tests passed (33existing+4dedicated). Tests cover tie/singleton/missing/zero, Big5+quoted CSV/BOM/newline/escaped quotes, shared polygon holes and boundaries,456IDs, conservation, SHA inputs, attribution and deterministic all-village scores.

Root staged build and /review/ prefixed build passed. Browser suite passed at root with deterministic tiles, root with REAL OSM tiles, and /review/ with deterministic tiles: real local datasets,503fail/retry,456 paths/list,6cards/2NAs, district53Da'an villages, search/empty result, different-village card changes, outline pointer click, drag pan, zoom control, city reset, OSM attribution, desktop/mobile no horizontal overflow, no JS errors, no full tree fetch and one request per dataset per loading attempt. Screenshots under test-results/village-game/{desktop,mobile}.png. Real-OSM screenshot visually inspected; tiles rendered. Stubbed prefix screenshots can overwrite root screenshots; preserve separate copies when comparing.

No original checkout, production dist, service config, DNS, package, Vite config, explorer/shared internals or existing data snapshot modified. No commit/push/deploy. Only registry02 label/status/statusLabel/description changed (path and all other registry entries unchanged). Parent owns integration and publication.

Final review evidence: compact JSON216,903bytes; real initial-load OSM probe received15/15tile responses HTTP200. Visually inspected desktop-initial-real.png (all-city456outlines) and mobile-selected-real.png (龍安里 highlighted at street zoom). Both under test-results/village-game/ and copied to /Users/piyellow/.openclaw/media/village-game/ for reviewer access. Final standard build/browser re-run follows registry metadata update. Local staging servers only5192(root) and5193(prefix), no production process changes.
