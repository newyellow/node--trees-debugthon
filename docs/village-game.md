# Social Game 公園：里環境護照 MVP

Current contract: see “Current social-game scope correction” below. Five axes/cards, three scored; clean bins removed from SOCIAL GAME only. Earlier acceptance entries are historical.

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


## Fullscreen map revision (2026-10-24)
Map occupies the full viewport (100dvh); no document-level scroll. Finder, capability legend, methods/provenance and selected-village passport are mutually exclusive, internally scrollable overlays. Initial state is map-only with compact controls. Selection opens a right-side passport on desktop and bottom sheet on portrait mobile, close/Escape returns focus, and the toolbar reopens the passport. Polygon styling follows actual geometry and preserves capability fill on selection.

Four scored capability colors: tree density green #238443, protected-register density amber #e58b19, source-name richness violet #8654b9, clean-bin density blue #1685b5. Highest finite score (0–100) wins; positive ties use rose #b45b83 and list all leaders. All-zero or unavailable scores use neutral #a6adb0 with distinct text; native/bird N/A never enter color selection. Fill opacity is fixed, not another measurement. These are snapshot-relative strengths, not ecological health. Existing JSON, score formulas and source exclusions unchanged.

Root cause of the selection rectangle: Chromium native focus outline on Leaflet SVG path surrounds the path's rectangular bounding box (observed auto/5px outline for pointer focus). Only :focus:not(:focus-visible) is suppressed; keyboard focus keeps a high-contrast outline and dashed polygon stroke. Enter/Space selects a focused polygon, and the accessible finder remains available. Disabled zoom animation plus nonanimated fitted views prevents an outstanding zoom transition from restoring an obsolete center after desktop-to-mobile resizing. Selection fitting reserves the mobile sheet area.

Acceptance includes 456 filled shapes, all four capability colors/tie/neutral, six cards/two NAs, focus-visible/Enter and pointer outline regression, closed initial overlays, panel scroll without map movement, close/reopen/Escape focus return, search/filter/reset/pan/zoom, desktop/390x844 portrait/667x375 landscape full viewport and selected village visible above portrait sheet, 503 retry and no full tree GeoJSON. Use local review port5194 (VILLAGE_GAME_URL override), isolated build test-results/village-game-fullscreen-build, screenshots test-results/village-game-fullscreen; use TREES_STUB_TILES=0 for separate real OSM verification. No new data downloads, account/storage functionality or explorer changes.

## Map-first overview / aerial comparison (2026-10-24)

Selection now opens a genuine Leaflet popup at the pointer lat/lng (finder/keyboard use village bounds center), not the detail pane. White rounded overview has a real bottom tip, four-axis reusable radar, brief snapshot counts, dominant capability, explicit native/bird N/A, and two actions. 查看細節 opens the six-card right overlay/mobile sheet; 種樹建議 opens its dedicated field-audit section with current-village evidence and explicit no location recommendation/legal authorization. Complete methods/provenance remain one action away. Escape closes detail first, then popup, with focus restoration. 里概覽 reopens the selected popup. No new weather/story data or claims.

Hover uses one lazily-created/replaced pointer-transparent flat HUD, no Leaflet tooltip/bubble/arrow. It shows the village and compact reusable radar, with native/bird N/A separately. Hover opacity .78 restores to .48 (or selected .70); capability color remains unchanged. Keyboard focus shows equivalent preview and Enter/Space opens overview; touch relies on tap, not hover. Popup click/wheel propagation is contained; panels retain their own scroll.

Upper-left 底圖 selector defaults to OSM and makes no PHOTO2 requests until selected. Scoped adapter (no explorer startup/cache import) uses official https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}, maxNativeZoom19, attribution ©內政部國土測繪中心. Visible note calls it latest stitched aerial imagery, not live or a precise photography date. Switching preserves viewport, data, filter and selected capability styling; only one tile layer is mounted. Aerial tile error falls back to attributed streets with explicit retry. Street error keeps usable village geometry and retry. Browser caching can avoid repeat requests, so failure tests zoom to a fresh viewport before injecting 503.

Review: Node24; root build test-results/village-overview-build, prefix /review/ nested under that staging directory, loopback5196 using existing static serve/config. No production dist/config/source snapshots touched; no commit/push/deploy. Existing node_modules read-only symlink is intentionally untracked (do not stage it).

Acceptance: 45/45 unit tests (including separate radar worker tests); root browser suite with deterministic OSM+NLSC, root real-OSM suite, prefixed deterministic suite. Preserves full viewport,456 shapes/palette/tie/zero, six cards/two NAs/exact values, search/filter,503data retry, reset/pan/zoom, focus outline regression, Escape/focus return, provenance, no full tree fetch and bounded data fetches. New checks cover flat hover opacity/restore/exact four radar values, pointer/keyboard popup vs hidden detail, genuine tip, detail/advice actions, popup scroll containment, mobile/touch overview bounds, official WMTS y/x, attribution, lazy imagery, single layer, selection/viewport preservation and aerial failure/retry. A single focused live NLSC viewport returned25/25HTTP200 tiles (no aerial in the long real-OSM suite). Evidence under test-results/village-overview and /Users/piyellow/.openclaw/media/village-overview/. Root screenshots visually inspected for desktop hover/overview and mobile overview. Provider availability and imagery dates beyond the visible provider metadata are not guaranteed.

## Polygon-bound hover correction
Hover ink is now an SVG group in the same Leaflet renderer as the village geometry: fixed interior map anchor, village name and reusable radar, no HTML card/background/arrow. Pointer movement within one village does not reposition/rebuild it. A scanline anchor respects concavity, holes and multipolygon gaps; fixed-size ink may overflow narrow boundaries. Pointer events pass through all SVG children; keyboard focus still previews, Enter/Space opens overview. Drag/zoom starts, filter/reset, reload, Escape, popup and panel clear hover and restore fill; renderer coordinates reproject on viewreset/moveend. No score/source changes.

## Six-axis emoji radar (2026-10-24)
The display adds native share 🌱 and birds/insects 🦋 as unavailable axes beside 🌳 tree density, 🛡️ protected register, 🌿 source-name richness and 🚶 clean-bin convenience proxy. Display order follows the six detail cards. N/A stays null and is drawn at the zero-radius position only; it remains explicitly N/A, not measured zero, and cannot participate in ranking, dominant capability, or map color. Four scored CAPABILITIES are unchanged apart from emoji metadata; separate RADAR_CAPABILITIES defines six display axes. Both polygon hover and selected overview reuse the same six-axis renderer. No dataset or score formula changed.

## Optional record layers
The left 資料圖層 overlay is separate from village statistics. All record layers start unchecked and dataset bytes are fetched only when checked. The existing explorer point renderer and scene are reused without booting the explorer. Viewport clusters progressively expose individual source records; source attributes and provenance remain available. Village finder/search positions the map but does not silently filter record names or recompute village scores. Clean bins refer specifically to the official pedestrian clean-bin source, not every type of garbage container; protected-tree register is dated, not a present legal determination.

## Village-internal individual trees
Hover debounces a village preview; selecting a village pins its complete managed-tree records until reset or the clear control. Leaving a hover restores the pinned village, or clears the preview if none is pinned. No raw-tree cluster, sample, or record cap is used. Every source record remains individually inspectable, including same-coordinate records. This is the street+park managed-tree source snapshot, not every real tree or the separate protected register. Persisted identity-safe assignment and lazy per-village shards precede publication; no SQLite runtime/backend is needed for the static host. Enabled checkbox layers remain unchanged outside the raw village; exact source+TreeID duplicates already shown by the individual layer are excluded from managed-tree clusters, restoring on clear.

Filtering a pinned village out of the finder also clears its individual-tree layer; late requests cannot resurrect it. A tree popup pins the current hover without rebuilding its canvas, and automatic hover cannot replace the source fields while any popup is open. Raw tree popups hide the compact status overlay to avoid covering fields on mobile.

## Current social-game scope correction (2026-10-24)
This section supersedes historical six-card/six-axis/four-scored/bin statements above. SOCIAL GAME alone now has **five cards and five radar axes: three scored tree indicators + native/bird-insect N/A**. Clean-bin source metadata, counts, density and scores are absent from village-game.json, its preparation, supplemental social record catalogue, overview, field-audit evidence and checkbox UI. Existing shared explorer manifest and clean-bins.geojson are preserved; social definitions explicitly filter that ID as a defense against an older catalogue. The record publisher now publishes only the protected supplemental source; generic historical CSV validation helpers remain for existing inventory tests. No source refresh/download occurred. Existing provenance dates, all 456 villages, tree/protected counts, source names and the three scores are preserved; no new timestamp implies a refresh. The village-tree manifest's village-game byte hash is updated, not its records or source hashes.

Removing a scored axis does **not** redistribute points or change denominators: each retained score is the same fixed-456-village zero-anchored midrank. Dominant capability ignores binDensity even if supplied by a stale object; the palette now has three capability colors + tie + neutral. Current snapshot: 433 single leaders, 13 positive ties, 10 neutral villages. Still no total score. N/A is null, never a measured zero.

Managed-tree point colors use shared speciesName normalization of original TreeType and deterministic speciesColor, identical across street/park and raw/checkbox layers. Unknown/dead-status 枯木 are neutral gray; mixed-category clusters gray-blue. These are **source-name categories**, not verified taxonomy or unique physical-tree identity. No source feature is decorated or changed. Dynamic legends expose the top eight categories and native keyboard-accessible expand for the rest, with bounded scroll; raw legend describes the current village and checkbox legend the enabled managed sources outside the raw-tree exclusion. Counts describe records, not biological individuals.

Hover radar uses its own pointer-transparent Leaflet SVG renderer/pane at490, above raw canvas470 and record panes450/460, below tooltip650/popup700. Polygon renderer stays400, so selected/hovered polygons cannot cover points. Hover uses layer-point reprojection with the dedicated renderer's viewBox, fixed interior anchors and existing clear-on-drag/zoom/filter behavior. Tests assert actual tree canvas pixels overlapping radar bounds, pane ordering and pointer pass-through, not a z-index on the polygon group. Actual isolated raw canvas pixel colors are checked against species colors; original-field, duplicate/overlap, all-record conservation and stale-load tests remain.

Verification uses Node24, isolated test-results/social-change-build (root5197), prefix test-results/social-change-prefix-host/review (5198). No production dist, service configuration, explorer sources, push or deployment is part of this change. Browser scripts run with deterministic OSM/NLSC tile stubs while all local source records are real.

Acceptance for this scope correction: **79/79 unit tests**, root and /review/ builds, and all **six browser gates** (game/individual trees/record layers at each base) passed with no browser errors. The largest village still renders all6,389 individual records. Cached preparation was executed in an isolated scratch root with only the protected CSV available: all456 published village values/scores and input hashes matched exactly, with no bins input or network refresh; the published JSON retains its original fetch/preparation timestamps. A direct old/new JSON comparison verified that only the requested bin source and fields changed. Desktop radar-above-trees, overview/species legend and mobile original-field popup screenshots were visually inspected. Screenshots remain under test-results/village-trees and a reviewer copy under ~/.openclaw/media/social-change. Tile images were stubbed; this change makes no new live provider availability claim.


## Three-level social navigation (2026-10-24)

Supersedes the historical hover-radar, pointer-anchored popup, tree-popup and no-total statements. Overview → village → tree are explicit levels (stage data-level). Overview hover/focus displays white village name and five fractional gold stars, with all records lazily previewed in species colors; no hover radar. A tree in an overview preview first selects its village. Village click/finder Enter/polygon Enter fits the complete geometry, reserving a measured north bubble band plus toolbar and 10% padding each side of the usable geometry viewport. Fractional zoom avoids clipping skinny/multipart polygons. The bubble is fixed at bounds north / longitude center, never the click coordinate, with no auto-pan. Tree level additionally reserves the responsive right sidebar; closing it restores village fit. Closing the village bubble clears records, highlights and selection, restores overview camera, and suppresses accidental focus-return preview. Escape unwinds one level; auxiliary panels close before the village bubble.

Temporary **資料綜合星等（暫定）** uses social-state.js RATING_POLICY three-capability-mean-v1. Only CAPABILITIES (treeDensity, protectedDensity, richness) participate; equal weights default1, easy to change/version independently of source scores. For valid finite0..100 scores with positive configured weights: weighted mean /20, rounded one decimal. Null/missing/out-of-range axes excluded from numerator AND denominator; actual0 retained; no valid axes => N/A. Five-star fill is proportional to the one-decimal value, not five rounded discrete stars. This is a snapshot-relative composite, not Google reviews, ecological quality/health certification, biodiversity census or advice to intervene. Village area, sampling and protected-register coverage affect it. Source scores/datasets unchanged.

Selected-village hover uses L.tooltip with **name only**, highlights every equal shared-normalized TreeType in that village and dims others; leave restores all colors/opacity. Keyboard canvas focus/arrows provides the same name/highlight and Enter opens a record; touch tap also opens it. The right species panel does not call L.popup/openOn and cannot replace the village bubble. It retains every original field (including underscore-prefixed values), coordinates, source index/hash and all coincident records. Close returns focus to the raw canvas and clears highlight. Other villages cannot replace a selected preview by hover, but remain explicitly clickable.

Stories: story-panel.js integrates the parallel story-query.js API directly, lazy loading only on record open; shared loader caches successes, retries failures, and generation tokens prevent a closed/replaced panel being overwritten. Groups are explicit local-village, same-district regional, other-location/species background and unverified leads. No exact local result is honestly empty, never fabricated or inferred from GIS. Failed/not-yet-completed fetch is not no history. All supplied text uses textContent; links permit only http(s), noopener noreferrer. No online AI. No all-city managed-tree download unless an existing checkbox layer is explicitly enabled; uncapped6,389 village preserved. Loader hash/LRU/race/clear behavior remains unchanged.

Reproduce with Node24: npm test; build root test-results/social-states-build and prefix test-results/social-states-prefix-host/review (--base /review/). Existing static serve runtime/config on loopback5201 and5202 only. Run scripts/check-social-states-browser.mjs with VILLAGE_GAME_URL for each base. Established game/tree gate names delegate to this changed-contract suite; record-layer gate is retained (projection corrected for fractional tile scaling). Suite checks desktop1440x1000 / touch390x844, all three levels, actual real-record pointer hover/tap, same-name count, bubble coexistence/north fit, right sidebar exclusion, smallest/largest aspect ratios,6389 records, keyboard/focus/unwind,456 village palette/finder/district/empty/reset, lazy stories, delayed story replacement race and503 recovery, dataset503 and shard503 retry, full fields, no global managed tree fetch, no overflow/browser errors. Unit tests separately retain all source/hash/conservation/cache/race/coincident-record contracts plus rating partial/allNA/zero/weighted and all456 independent means. Tiles are deterministic stubs, not new live provider evidence. Evidence: test-results/social-states/{desktop,mobile}-overview.png, desktop-tree-hover.png, {desktop,mobile}-tree.png; reviewer copies ~/.openclaw/media/social-states/.

Verified acceptance: Node24 npm test161 total /160 pass /0 fail /1 pre-existing skip. Root and /review/ production builds pass. Both bases pass the three-state desktop/touch suite and the independent record-layer browser gate (errors=[]). git diff --check clean. Latest desktop name-only tooltip/highlight and mobile three-level coexistence screenshots visually inspected. Temporary node_modules link removed after checks; no install, source-data/config/package mutation, commit, push or deployment by this worker.


### Review corrections: story-first and unobscured overview

Raw legend/status is now a native disclosure collapsed by default, suppressed while the overview name/stars are shown. The always-keyboard-reachable toolbar button「里內樹圖例」explicitly reopens it; after preview clear it describes the **last inspected village** (not current all-city records), without resurrecting points or changing navigation level. Browser asserts actual name/stars bounds do not intersect any visible UI surface on desktop/mobile, and tests the legend button via focus + Enter.

The record sidebar now starts with heading/source then **stories**, not a long field list. All original fields, coordinates, hash/provenance and same-coordinate selection remain in「完整原始紀錄／同座標紀錄」native details, collapsed by default **below stories**. Browser focuses its summary and presses Enter before comparing every original field; mobile-stories-first.png shows the initial story-focused view separately from expanded-field evidence.

Bubble maxHeight is recomputed from the real responsive toolbar and available viewport before fit. At667x375 landscape the bubble scrolls internally instead of exhausting the geometry viewport; village and tree fits assert complete polygon bounds below the bubble and left of the sidebar, with no toolbar overlap. Additional check-social-baseline-browser.mjs is automatically invoked by the main state gate (and therefore old game/tree entrypoints). It restores aerial503 fallback/retry, stale tile-status clearing, street/aerial viewport preservation, one tile layer, NLSC y/x and attribution, OSM attribution, real pointer drag/zoom/reset at fractional fit zoom, real zero-record village, true0.0/5 village, and landscape village/tree checks. The independent record-layer gate remains separate.

Highlight tests now sample **actual raw-canvas RGBA pixels** of isolated source records: equal-normalized species retain RGB/alpha, other species alpha falls below40% of baseline, and mouse leave restores every sampled RGBA exactly. Counts remain separately checked against all source records. No instrumentation replaces real pointer interaction. Updated evidence includes mobile-overview.png, mobile-stories-first.png, desktop-tree-hover.png, landscape-village.png and landscape-tree.png in test-results/social-states/ and ~/.openclaw/media/social-states/; reviewed visually with deterministic tile stubs.

## Social media / six-score interface (2026-10-24)
Current UI supersedes historical five-axis/three-score/empty-group behavior. The loader fetches social-metrics.json once per attempt alongside game/regions, verifies actual game SHA-256, then uses applySocialMetrics (version/seed/snapshot/input hash/456-ID/count validation). Six axes and equal-six composite include three observed-source proxies, the blueprint-native proxy and TWO seeded DEMO axes. Entry toolbar, hover stars, radar, overview composite, detail cards and methods identify simulation. Native card shows matched/all-managed counts: unlisted means assumed non-native ONLY for this blueprint prototype, not botanical determination. 回報活躍度 is seven-day simulated reported/due-tree counts, not citizen reports. Existing data and all 53 story entries remain immutable.

Selecting an individual tree places exact flora lookup at the top of its sidebar, above culture stories and collapsed original fields. Read-only imports from 03/model.js reuse createClient/safeImage, not planner startup. GET /plants/?q=NAME&limit=12 only on tree open; NFKC/whitespace normalized vernacular equality, never first fuzzy result. Unknown/mixed categories are skipped. Every same-name candidate ID/scientific identity stays separate, labeled API資料待覆核. Structured fields only; unlicensed description is deliberately omitted. Native API flag is display-only. Bounded 12s timeout, <=24 memory results, close/change cancellation and stale tokens, manual retry with Retry-After cooldown. HTTPS photos require planner CC0 or attributed CC-BY/SA policy, no-referrer, source/license/credit; otherwise compact source-only/missing display.

Culture stories entirely omit empty groups; successful all-empty query is one honest no-match note, not request failure. Supplementary social-story-media.json loads lazily only for matched articles and caches a validated versioned map. Only displayable status plus safe HTTPS image/source/license URLs, credit and permitted license render an image INSIDE its matching story article with caption/source/license. Other statuses use original source links only. Generic plant photos never become story-event imagery. Supplementary failure cannot erase a valid story.

Verification: Node24.22.1 + installed Chrome; npm test; isolated root build test-results/social-media-build and /review/ build test-results/social-media-prefix-host/review. Ports5205/5206 only. Updated check-social-states-browser.mjs automatically runs baseline gate; independent check-village-record-layers-browser.mjs at both bases. check-social-media-browser.mjs runs against local Vite5205 to exercise source modules: exact/fuzzy rejection, missing image, duplicate exact candidates, stale cancellation, memory cache, unknown skip, 429 cooldown, lazy media/cache, unsafe media, credited safe image and all-empty group removal. One live selected 榕樹 query verifies browser CORS and actual CC0 photo load; network availability is not a timeless guarantee. Screenshots test-results/social-states and test-results/social-media/real-flora.png; reviewer copies ~/.openclaw/media/social-media. No source datasets, production services, git index/commit/push/deployment touched by UI worker.

Audited supplement delivered: six genuine story photographs carry the Taipei government website open-data notice, not Creative Commons. story-media.js permits this exact notice only with www-ws.gov.taipei images and audited www.gov.taipei/pkl.gov.taipei source/license hosts; arbitrary license text is not accepted. check-social-story-media-browser.mjs verifies actual lazy catalogue→matching story ID→government image load and full caption/license/agency attribution (one live image). Latest complete unit run:172 total /171 pass /0 fail /1 existing skip. Root and prefix build/state+baseline/record gates passed; deterministic tiles do not assert new OSM/NLSC provider availability.

Parent integration acceptance: empty story results remove the entire story section (including heading), while transport errors retain an explicit retry. API photos precede expandable traits/UUID/source metadata; reference photos never claim to depict the selected individual tree. Run `node scripts/check-social-media-e2e-browser.mjs` with VILLAGE_GAME_URL for Vite, built prefix or public origin: real same-name Flora lookup plus fully decoded photograph, original-story government image/credit, six axes, desktop/mobile and close-unwind. Source-module contract tests remain Vite-only.

## Smooth camera and interruption

The social map keeps fractional zoom (zoomSnap 0), native Leaflet tile / marker
zoom and fade animation, half-level zoom buttons, 110 wheel pixels per level,
and 35 ms wheel debounce. Village and tree-side-panel framing uses the existing
80%-usable-area padding calculation over the full geometry (north bubble,
toolbar and sidebar included), capped at zoom 18. Flights take 450 ms; closing
village pulls back 1.25 levels in 400 ms from the **current** camera center, with
the map minimum as floor. It never restores a saved pre-selection overview.
Initial city framing is instant; explicit city reset remains available.

Camera intents synchronously stop the previous flight before calculating a new
one. There are no completion callbacks that reselect / refocus old villages.
Pointer/touch/wheel and drag may interrupt flights; basemap toggles do not move
the camera. Resize while selected immediately reapplies current responsive fit.
Reduced-motion is live: flights settle instantly and native zoom animation is
disabled only while the preference is enabled, then restored to Leaflet's
original capability. Tree pointer/keyboard hit testing and overview hover
preview are suspended during camera motion so cached canvas point positions
cannot open a wrong record. Closing remains tree → village → overview.

Read-only stage DOM diagnostics: data-camera-phase (idle/moving),
data-camera-zoom, data-camera-lat and data-camera-lng. Tests wait for idle before
geometry or tile-origin source-coordinate projection; no writable map test API.
Leaflet's bounds calculation and native zoom transition finalizer are used
internally to preserve exact padding and safely interrupt a native CSS zoom.

Camera verification: node --test tests/camera-motion.test.mjs and
VILLAGE_GAME_URL=<full-root-or-prefixed-url> node scripts/check-social-camera-browser.mjs.
The public-compatible browser gate records rAF logical zoom plus actual polygon
bounds and tile matrices, checks intermediate frames within the first 400 ms,
three viewport sizes, fractional button/wheel movement, drag-center pullback
(with subpixel Leaflet rounding tolerance), fast retarget / close / reset,
live reduced-motion both ways, and a real CDP two-finger mobile pinch. Artifacts
are written outside the repository to ~/.openclaw/media/social-camera. Existing
state / baseline, actual source record hit quality and bounded real-media gates
remain separate and retain all prior assertions. Remote test tiles are stubbed;
these checks do not certify a basemap provider's availability.

## Compact selected-village summary

Selected-village bubble now contains only the six-axis radar, fractional star glyphs/numeric rating, and action buttons. Village identity remains in its accessible label and the detail overlay heading. Statistics, composite formula, simulation/proxy explanations and per-axis denominators are shown in 查看細節; the global DEMO banner remains visible. Camera behavior, datasets, story/media and rating calculations are unchanged. Focused acceptance: node scripts/check-social-summary-browser.mjs (VILLAGE_GAME_URL selects built/public URL).

## Story-first tree sidebar

The selected-tree sidebar reserves stable hosts in this order: plant photos, cultural stories, collapsed plant traits, collapsed research coverage, full original records. Separate async targets keep this order regardless of API/catalogue completion order; cancellation and retry retain the targets. The research caveat travels with coverage. Social-game API reference images accept credential-free HTTPS URLs regardless of licence category and retain original source/author/licence metadata; displaying or linking does not assert permission or an open redistribution licence. Shared planner safeImage and audited story-image rules are unchanged; Wiki fallback remains exact-species and handles absent/broken API photos. Run scripts/check-social-story-first-browser.mjs for one bounded mocked ordering/image/source-link check, not subjective animation testing.

## Minimal toolbar and indicator navigation

Overview hover retains village name and visual fractional stars only; numeric rating and DEMO text are available to assistive technology/details but not drawn beneath the hover stars. Toolbar contains only basemap, record layers and finder; retired city-reset, capability/method, dynamic passport and tree-legend toolbar entries are removed. Village details open 指標含義, combining capability legend and full method/provenance. Back, close or Escape restore village details and keyboard focus without camera movement or changing selected village. Global DEMO disclosure remains. Focused smoke: scripts/check-social-toolbar-browser.mjs. Old broad gates no longer attempt intentionally deleted reset/tree-legend controls; interaction feel remains user-tested.

## Roomier selected-village framing

Selected-village framing now uses a five-percent viewport margin above the combined north bubble/village and below the village. The separate toolbar-height reservation and old ten-percent vertical breathing room are removed; north-bubble and sidebar/horizontal clearance remain. Menu DEMO banner is removed; simulation/proxy disclosures remain in village details, indicator meanings and accessible labels. Visual zoom/fullness acceptance is explicitly user-owned; only unit arithmetic/build and normal public loading are release checks for this adjustment.

## Star-hue choropleth and global village ranking

Village polygon fill now uses the unchanged displayed one-decimal composite star value, grouped by nearest whole star: 0.0–0.4 brick red, 0.5–1.4 orange, 1.5–2.4 gold, 2.5–3.4 green, 3.5–4.4 blue, 4.5–5.0 purple; invalid ratings are neutral gray. This is hue variation, not a sequential opacity scale. Resting fill opacity is reduced relatively twenty percent (0.48→0.384; selected 0.70→0.56), hover remains 0.78. Tree-point species colors are unchanged.

里排行榜 is a left overlay of all456 villages using those same exact stars descending, independent of finder filters. Equal displayed ratings share competition rank (1,1,3), deterministic ID orders ties; N/A is last/unranked. Clicking a row clears finder filters so its polygon exists, then uses the existing select/smooth-camera path and closes the ranking panel. It never recomputes scores or simulation values. Rating map palette and six radar indicator meanings are both available in 指標含義. Validation is pure policy/snapshot unit tests, build, and one functional ranking/navigation flow; subjective hue contrast and camera feel remain user-owned.
