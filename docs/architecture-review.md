# Data and map composition architecture review

Reviewed 2026-10-23 against committed foundation 2debea5 and the working tree. Story edits were in progress and are provisional observations, not production claims. This document is a review/proposal, not an implemented API or migration. No application source, datasets, service configuration, or production build is changed by this review.

## Verdict
The MPA site boundaries are suitable for parallel features. Shared snapshot files and reusable pure spatial/statistical algorithms already exist. There is NOT yet a reusable data-access API or a composable application-wide map-layer API. A new site currently must duplicate loading/cache/validation and construct a map independently or depend on explorer internals. Address this before adding multiple substantial analytical sites; a framework rewrite or database is not currently necessary.

## Observed dependency flow

    preparation scripts -> public/data manifest + GeoJSON + regions
                               |
                  explorer main state/loader/RBush
                     /          |          \
               points       density       species UI
                     \          |          /
                         Leaflet + LayerScene

    stories (working tree) -> own fetchCollection/cache -> topic selection
    portal -> site metadata only (deliberately no dataset/map imports)

## Existing strengths to preserve
- Single read-only public/data source; sites do not duplicate snapshot files. Vite MPA entries and docs/multisite.md define site boundaries.
- Coordinate conversion, geometry operations and derived memberships run outside rendering. Current pure modules density.js, spatial.js, analysis.js, species.js and explorer.js import successfully under Node without document/window/Leaflet startup.
- LayerScene reconciles stable keys and style changes instead of clearing all layers every frame (src/layer-scene.js:2-31).
- Sidewalk worker and AnalysisCache deduplicate work across viewports; unit tests cover incremental rendering, failures and conservation.
- Provenance/limits are surfaced; species statistics distinguish missing names and non-species status. Preserve raw source values and do not assert botanical taxonomy or individual historical provenance.

## Findings, ranked

### P1: Data access is owned by a page, not a reusable service
src/main.js:18 stores UI selections, datasets, request state, and errors in one object. loadLayer at157-174 fetches, validates minimally, builds RBush, mutates state, and calls DOM/render functions. Another site cannot reuse it without explorer UI. Regions are separately fetched by analysis-ui.js:35-47 and species-ui.js:16-20; provisional story main.js:4-9 adds another cache/fetch implementation. This causes diverging validation/retry contracts; within explorer regions can be downloaded/parsed independently by two modules.

Action: introduce an injected repository independent of DOM/Leaflet. All sites and analysis adapters use it. Cache is per page/session, not magically shared across MPA navigation; HTTP cache can reuse bytes, but JS parsing and indexes are rebuilt per document. A shared worker/backend is a later measured optimization.

### P1: Membership integrity is positional, not content-addressed
prepare-regions.mjs:44-53 stores membership arrays in feature order and treeSnapshot=manifest.fetchedAt. analysis.js:12-16 and species.js use length-based guards; UI checks the timestamp. Equal-length reordered/altered datasets are not detected by these checks if the token is unchanged. An in-memory two-record reproduction swapped two records and moved the queried species to a different village without rejection. This is a latent contract risk, NOT evidence that current official snapshot assignments are wrong.

Action: manifest schemaVersion, dataset content hashes, ordered-record/geometry fingerprints, boundary digest and membership algorithm version. Validate before analysis. Prefer stable namespaced IDs for joins; preserve source index only as a snapshot-local implementation detail. Do not feed an arbitrary filtered/subset array into positional aggregation: use a repository selection with source indices or join by ID.

### P1: Multi-file refresh is staged but not a single transactional snapshot
prepare-data.mjs:62-63 renames files sequentially, then manifest; package.json:10 rebuilds regions only after that script succeeds. Downloads/conversions are staged, but readers or a later failed regions rebuild can see mixed generations. Existing UI version check can fail closed; it does not provide release atomicity.

The --cached preparation path also rewrites fetchedAt even without a fresh source download (prepare-data.mjs:19,24-30,62); separate sourceFetchedAt from preparedAt and retain converterVersion plus raw/output hashes. Action: generate and verify all data+derived artifacts in an immutable version directory, then switch one current manifest/pointer only after validation. Publish hashed URLs; retain previous release for rollback and in-flight readers. Do not auto-refresh data merely to build a UI release.

### P2: Map composition is coupled to mutually exclusive UI modes
main.js:23-29 creates panes and a single scene; renderMap branches on points/density/species. LayerScene.begin(scope) removes previous entries on scope change. This is correct for current modes, but cannot independently combine a story selection, species points, district outlines and future canopy mask without custom branching. point-layers.js:5 receives the entire UI state and map.

Action: per-map layer registry with independently mounted controllers and stable namespaced feature keys; preserve LayerScene inside each controller. Shared map shell owns panes, attribution, viewport events and lifecycle. Pure analytics must never import the shell. New site does not import src/main.js to reuse data.

### P2: Query semantics and feature identity need explicit contracts
Explorer matches uses source district; official administrative aggregation uses spatial membership; park grouping uses source name/district; sidewalk search filters sidewalks while nearby trees remain citywide. These differences are intentional and MUST NOT be flattened into a universal district string. Species selection currently affects distribution, not composition denominator. TreeID identifies a source record, not proven cross-dataset/cross-year physical-tree identity. Existing map keys often use WeakMap array offsets (main.js:169; point-layers.js:12).

The ingest currently does not generate feature.id or validate source IDs (prepare-data.mjs:35-49). Independent audit found nonempty unique TreeID values within both current tree layers; this is a snapshot observation, not a future guarantee. Add ingest uniqueness checks and snapshot-scoped fallbacks for other datasets. matches() lowercases field values but relies on callers to normalize query input (explorer.js:1-6); put that rule in compileQuery rather than each UI. Action: explicit districtBasis, geometryPredicate, targetDataset, taxonMatch and denominatorScope, plus a selection provenance descriptor. Result = records/statistics + total/known/unknown/unassigned + snapshot + method/options. Invalid/unsupported combinations fail, not silently reinterpret. For polygons distinguish bbox candidate search from exact intersection.

### P2: Asset delivery scales with whole datasets
Current public/data totals roughly115MiB on disk; tree files are roughly39MiB+29MiB. Lazy layer loading avoids fetching everything, but each requested layer is parsed whole and its index built per page. No runtime CPU/memory benchmark was conducted in this review; do not promise latency.

Action: first centralize loading/indexes and measure cold fetch/parse/index, main-thread blocking, memory and warm query times on representative desktop/mobile. Only then consider district chunks, vector tiles or a spatial API. Future imagery inference uses a separate cancellable bounded queue/worker/service with versioned result cache, never map paint callbacks.

## Proposed module boundaries (not existing files)

    src/data/        catalog, repository, schema/identity, selections, provenance
    src/domain/      spatial, projection, species statistics, region/sidewalk analyses
    src/map/         map shell, layer registry, point/boundary/result adapters
    src/features/    explorer-specific orchestration and UI
    src/stories/     story-specific UI/content/eligibility
    src/portal/      entry navigation only
    src/shared/      small pure site metadata/utilities

Data/domain cannot import document, window, Leaflet or site DOM. Map can depend on data/domain, never vice versa. Story-specific exact label eligibility remains a feature predicate, not a universal botanical synonym rule. Extract projection from density module into domain/projection only as a compatibility-preserving move. Avoid making shared a miscellaneous dependency bucket.

## Proposed API sketch (illustrative, not available today)

    const repository = createDataRepository({ baseUrl, fetcher });
    const snapshot = await repository.openSnapshot({ signal });
    const catalog = snapshot.catalog();
    const selection = await snapshot.query({
      datasets: ['street-trees', 'park-trees'],
      bounds: [west, south, east, north],
      geometryPredicate: 'point-within',
      district: { basis: 'spatial', id: districtId },
      species: { basis: 'source-label', values: ['榕樹'] },
      text: '',
    }, { signal });
    const record = await snapshot.getRecord({ datasetId, sourceId });
    const regions = await snapshot.getBoundaries('village', { signal });
    const composition = summarizeSpeciesSelection(selection);

classifySourceLabel(raw) should expose raw, labelKey, status, normalizationVersion and taxonId:null until a sourced taxonomy mapping exists. Queries distinguish rawEquals from labelKeyEquals; story exact-label rules are not silently normalized into broader species matches. openSnapshot pins a manifest generation; getRecord rejects ambiguous duplicate source IDs. Internal identity includes dataset namespace and snapshot generation; source identity survives snapshots only under documented source guarantees. Query returns an immutable/read-only selection with stable handles, original source indices where needed, version and quality metadata; no Leaflet objects. Normalized fields are additive (sourceSpeciesLabel, displayLabel, sourceDistrict, spatialDistrict); retain raw properties. Rejected request promises leave cache retryable; shared subscribers/cancellation must not abort another consumer's pending load.

    const shell = createMapShell({ container, repository });
    shell.layers.add({ id: 'trees', controller: createTreePointsLayer(...) });
    shell.layers.add({ id: 'story-selection', controller: createSelectionLayer(...) });
    shell.layers.setVisible('story-selection', true);
    shell.on('recordselect', ({ recordRef }) => showStory(recordRef));
    shell.destroy();

Layer controllers expose mount/update/visibility/destroy, own errors/loading and disposal, and never own the repository's raw mutable records. Define pane order/opacity/click priority; recordselect vs regionselect must be separate typed events. Destroy cancels owned work and removes listeners/layers; result identity includes snapshot+method+parameters. Region features and point records are different entities. Multiple simultaneous layers must not overwrite each other's scene keys.

## Frontend API first; HTTP API later if justified
The current static-hosted project can implement this as JavaScript modules over existing files. API means a stable programmatic contract, not necessarily a new server. Add a backend (and likely spatial storage) when measured needs require bbox-limited remote queries, multiuser persistence, controlled imagery inference, or large version history. Any backend must retain these contracts rather than exposing raw UI state. Never expose the local imagery cache automatically as a public service.

## Migration and acceptance gates
1. Extract catalog/repository + loader adapters; preserve current URLs and feature shape. Test one fetch per dataset per page across concurrent consumers; retry, timeout, schema rejection, subscription cancellation, no DOM imports; source counts unchanged.
2. Add IDs/versioned snapshot contracts to preparation and derived artifacts with migration tooling. Test duplicate/missing IDs; equal-length reorder/change rejection; atomic failed-refresh rollback; point/bbox/CRS and membership conservation. Do not silently reserialize existing datasets as part of loader extraction.
3. Migrate explorer/analysis/species and story incrementally to repository. Keep aliases/adapters and golden results (162369=162344 known+18 missing+7 dead-status;48 spatially unmatched for current tree snapshot). Preserve each query's source/spatial/sidewalk semantics and source-specific counts.
4. Extract map shell + layer controllers. Demonstrate trees + boundary + story selection coexist; hide one does not destroy another; one click maps to correct record; mount/unmount leaves no worker/listener leak; existing density/sidewalk/species regressions continue passing.
5. Benchmark and choose scaling optimizations only from measurements; no service/database rewrite as prerequisite. Browser gates include real-data desktop/mobile, root and prefixed MPA links, failure/retry, lazy no-home-data requests, Worker resolution and attribution. Stubbed tiles are not evidence of provider availability.

Each step is a separate reviewable change and needs its own tests before deployment. This review does not authorize commit/push/deploy or change parallel story ownership.

## Verification performed
- Code/path dependency review with cited sections above.
- DOM-free Node import smoke test of existing pure modules passed.
- In-memory positional-membership reorder risk reproduced without writing datasets.
- Current working-tree unit suite38/38 passed (includes in-progress story tests); committed baseline differs and story may change afterward.
- Independent read-only data-contract review cross-checked identity, both sides of membership ordering, source/preparation timestamps, mutable cache assumptions and exact-label query semantics; no application changes were made by either reviewer. Versioned cache keys and readonly records are proposed safeguards, not claims that stale results have occurred in the current fixed-snapshot UI.
- No new runtime-performance benchmark, backend, browser UI or deployment was performed for this review.
