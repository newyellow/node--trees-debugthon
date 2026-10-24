# Independent sites / 多子站開發契約

## Entry points
- /stories/index.html: story layout prototype; no published stories, submissions or storage.
- /: lightweight project portal; no map, dataset, remote font or tile imports.
- /explorer/index.html: complete existing data explorer. Density, species, regional and sidewalk analysis remain here; no feature split.
- /workspaces/02/index.html and /workspaces/03/index.html: provisional pages only (功能待定), not working applications.

Every directory has an actual index.html. Direct navigation and reloads use explicit index.html URLs, not SPA fallback. IMPORTANT: the existing runtime serve.json has cleanUrls:false and directoryListing:false; serve 14.2.6 therefore returns 404 for subdirectory slash URLs even when an index.html exists. All published navigation deliberately uses explicit index.html paths so the existing production configuration can stay unchanged. Vite build.rollupOptions.input lists all five entry files. Unknown paths should return 404.

## Parallel write boundaries
- Portal: index.html and src/portal/home.js.
- Workspace 02: workspaces/02/** and future src/workspaces/02/index.html**.
- Workspace 03: workspaces/03/** and future src/workspaces/03/index.html**.
- Explorer: explorer/index.html and existing src/*.js / src/style.css; keep prior module imports, worker and features intact.
- Coordinate changes to src/portal/portal.css, src/shared/sites.js, vite.config.js, package files and public/data. Workspaces can adopt private JS/CSS without modifying explorer assets.
- Numbers do not imply a future feature. Define goals before implementation. Integrate later via explicit pure shared modules, not cross-page DOM or implicit global state.

## Shared contracts
src/shared/sites.js is pure immutable metadata: stable id, label, status (available/prototype/provisional), visible statusLabel, base-relative path to an actual index.html, description. New sites need registry metadata AND real HTML + build input. Links use DOM textContent, not interpolated HTML. Placeholder titles use the registry; HTML has direct navigation even without JS.

public/data is the single read-only snapshot source, copied once to build-root data/. Never duplicate it under individual sites, refresh or download automatically. Existing manifest/schema/snapshot and region-membership contracts are unchanged. Explorer fetches use import.meta.env.BASE_URL + data/...; never document-relative data/... from a nested page. Shared modules must not fetch data or initialize maps implicitly. Worker(new URL(..., import.meta.url)) stays bundled and same-origin. Leaflet/remote font CSS remain explorer-only. Existing aerial-cache Vite plugin remains unchanged; production uses official remote aerial URLs. Offline downloads remain paused and cache is excluded from build output.

## Review and testing
This Mac uses Node 24.22.1 at ~/Library/Application Support/TreesDebugthon/node-v24.22.1-darwin-arm64/bin.

    npm run dev
    npm test
    npm run build -- --outDir test-results/multisite-build

Review staging only; never overwrite dist before approval. Use existing runtime serve package and existing serve.json on dedicated loopback port 5191; no vite preview or serve --single. No service, tunnel or configuration changes are required for explicit file URLs. Deployment is a separate approval.

    TREES_PORTAL_URL=http://127.0.0.1:5191/ node scripts/check-multisite-browser.mjs
    TREES_TEST_URL=http://127.0.0.1:5191/explorer/index.html TREES_STUB_TILES=1 node scripts/check-browser.mjs
    TREES_TEST_URL=http://127.0.0.1:5191/explorer/index.html TREES_STUB_TILES=1 node scripts/check-analysis-browser.mjs
    TREES_TEST_URL=http://127.0.0.1:5191/explorer/index.html TREES_STUB_TILES=1 node scripts/check-incremental-browser.mjs
    TREES_TEST_URL=http://127.0.0.1:5191/explorer/index.html node scripts/check-species-browser.mjs

Regression defaults target /explorer/index.html. TREES_TEST_URL is a full explorer URL including any deployment prefix; legacy PREVIEW_URL and BASE_URL are supported. TREES_STUB_TILES=1 stubs remote tiles for general/analysis/incremental checks; real local snapshots and business assertions remain unchanged. Species already stubs remote resources. Use real tiles for aerial checks to test provider failure/retry.

For prefix portability build separately with --base /review/ --outDir test-results/multisite-prefix-host/review and serve its parent. Verify portal links, backlinks, /review/data/* and /review/assets/sidewalk-worker-*; no fallback requests to /data or /assets.

## Concurrent story integration
Story-only commit 251d29a adds stories/index.html and src/stories/**, owned separately. Registry/build now expose it as a prototype with content pending, not a published story service. Preserve story ownership. Explicit index paths are required for its explorer/home backlinks under the existing static rules, including prefixed hosting.

## Tree culture research catalogue
`/stories/research/index.html` is a separate lightweight research-table entry. Its data loads are the compact `public/data/tree-cultural-stories.json` and `public/data/tree-history-search-coverage.json` (not full tree snapshots); the coverage panel distinguishes usable searches, blocked requests, unrequested names and invalid names. User-provided PDF citations show printed/PDF page and repository provenance without inventing public URLs; raw PDFs remain in repo docs only. Query ledger downloads include CSV/JSON. Story downloadable CSV and Markdown are generated by `node scripts/tree-history-data.mjs`. See `docs/research/README.md` for evidence scopes and editing rules. Source-supported is not independent historical proof or a match to present GIS individuals. Root/prefix navigation uses explicit index.html URLs.
