# Cultural story demos (review staging, 2026-10-23)

Two bounded, independently selectable demos live at stories/index.html. No backend, map, tile provider, new data snapshot, portal import, publication, submission, storage or deployment. Existing native draft disclosure and unpublished labels remain. Accessible real-record buttons are the click interaction, not a spatial map: selecting a button displays that exact snapshot feature's identity, coordinates, source fields and eligibility rule. All candidates are available in 40-row pages; southern records also have an exact-label filter.

## Selection and audit

Read-only inputs: public/data/street-trees.geojson (90,358), park-trees.geojson (72,011), and (mango only) parks.geojson (812). Manifest fetchedAt: 2026-10-23T06:37:44.947Z. Requests occur only after explicit load; base URL is import.meta.env.BASE_URL. Successful data are cached per page; failed requests clear cache for retry. Fetch timeout 30 seconds. Switching demos invalidates stale async rendering. Invalid schema, ambiguous/missing reference or duplicate eligible layer+TreeID fails closed. Empty selection explicitly says no match, with no substitute examples.

Identity: layer + ':' + original TreeID; detail also displays zero-based feature index. Original feature objects and [longitude,latitude] are retained, never generated/jittered/geocoded. Source field TreeType is authoritative for selection, not normalized _name. These are dataset label groupings, not scientific taxonomic determinations.

### 01 南國想像: 3,437 candidates

Exact original TreeType allowlist only:

| TreeType | street-trees | park-trees |
|---|---:|---:|
| 大王椰子 | 1,781 | 945 |
| 可可椰子 | 15 | 5 |
| 鳳凰木 | 230 | 461 |

No broad 椰/棕 substring matching. No inference that all palms represent a common taxon, introduction date or colonial planting motive. Other palm labels are deliberately excluded. Chinese labels do not certify scientific species; 大王椰子 is not silently merged with 可可椰子.

### 02 芒果與街區生活: 203 candidates

Exact TreeType＝芒果, never 檬果, 海檬果 or fuzzy aliases. 14 park records require ParkName＝青年公園 AND Dist＝萬華區. 189 street records require Region＝中華路二段, Dist in 中正區/萬華區, and haversine distance ≤1,000 metres from the unique official parks record pm_name＝青年公園 AND pm_regions＝萬華區. Anchor SeqNo＝992, original coordinates [121.505861,25.025110242]. 1 km is a declared demo search radius, NOT a park, national-housing or military-village boundary. There is no authoritative 中華路國宅 boundary in this implementation; it does not claim membership.

Known verified example: park-trees:WH0115001091, [121.5034871,25.0244854], TreeType 芒果, ParkName 青年公園, Dist 萬華區, SurveyDate 2023-05-15. Counterexample street-trees:DT0174210156 is excluded: its RegionRemark mentions 中華路二段 but Dist is 大同區 and geometry is far north. No searching all properties/prose/management fields for place strings.

## Sources and limits of historical claims

Data provenance links (copied from existing manifest, not presented as historical citations):
- https://data.gov.tw/dataset/128274
- https://tppkl.blob.core.windows.net/blobfs/TaipeiTree.json
- https://tppkl.blob.core.windows.net/blobfs/TaipeiParkTree.json
- https://parks.gov.taipei/parks/api/

**No new reliable historical page with supporting prose was fetched by this implementation. Therefore no historical assertion or citation has been fabricated.** Both contexts prominently say 待查證的研究問題 / 研究待補. Japanese-period tropical imagery and military-dependents fruit-tree life are explicitly research questions, not conclusions. Dataset clicks select contemporary records, not confirmed historical witness trees. Species, proximity, survey date, diameter or height cannot establish planting agent/date, settlement membership, tree age, food safety or a remembered event. No edible-fruit advice; UI says do not harvest/eat.

Parent independently reviewed the local official parks snapshot: SeqNo992 pm_overview includes「原為練兵場後改為機場」and「民國66年9月施建完工」. This can support future carefully cited park-site context, but not mango planting provenance. The current UI deliberately does not turn this into a historical story pending source review. No claims from uncited Wikipedia paragraphs or footer-only university pages are used.

## Verification

Verified Node: ~/Library/Application Support/TreesDebugthon/node-v24.22.1-darwin-arm64/bin/node.

- node --test: **38/38 passed** including 7 story tests. Selection tests use real local snapshots, exact IDs/coordinates/reference, eligibility exclusions, missing reference, duplicate IDs, schema/HTTP failures and honest empty selection.
- vite build --outDir test-results/story-cultural-build: passed, dist untouched.
- Serve staging using existing runtime serve 14.2.6 + existing serve.json (cleanUrls false, no SPA fallback), loopback 5193.
- node scripts/check-stories-cultural.mjs: passed at 1440 and 390 widths. Lazy loading, 3437/203 counts, label filter, pagination, exact WH0115001091 coordinates, selected-button state, native draft details, no overflow, HTTP503/retry, empty schema no-match, no browser errors and no tile/font/external requests. External image stub exists defensively; this demo intentionally requests no tiles.
- Screenshots: test-results/story-cultural-1440.png and test-results/story-cultural-390.png. Captured by Playwright. Agent visual inspection was blocked by local image allowlist / node file.fetch policy; automated geometry/interaction checks passed. Parent may inspect these files locally.

No commit, push, deployment, dist replacement, imagery refresh, data refresh, registry/config edits or external messaging.
