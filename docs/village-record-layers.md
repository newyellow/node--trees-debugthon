# Village record layers (private workspace module)

Import installRecordLayers from src/workspaces/02/record-layers.js; it imports its private CSS.

API: installRecordLayers({map,host,base='/',onFeatureOpen=()=>{}}) returns {ensure(),setFilter({district}),destroy()}.

Call ensure on first panel opening. It fetches ONLY BASE/data/manifest.json and BASE/data/village-record-layers.json, never full records. Supplemental metadata uses {schemaVersion:1,layers:[standard manifest definitions]}. Each definition requires id/title/kind(point or polygon)/file(relative .geojson path); optional color/source/agency/fetchedAt/valid/total fields are displayed. The original five plus supplemental two are generated from their catalogs, all unchecked. Network/validation failures show explicit retry buttons. Only checked datasets load. In-flight loads deduplicate, successful loads cache, unchecked late completion stays invisible, and destroy suppresses delayed UI results.

setFilter matches ONLY actual feature.properties._district. query is intentionally ignored: never couple village-name search to record text. Default is all viewport records. Status data-count is complete RBush bbox intersection count, never cluster count or sampling. Polygon count means bounds intersection (not exact polygon clipping). All overlap members remain available through the shared maxzoom19 list.

onFeatureOpen fires at preclick BEFORE the existing renderer popup/cluster click handler, not from popup content creation or popupopen. It can clear village hover/panels; closing the existing popup is also safe. Overlap-list button selection invokes it in DOM capture before the existing button onclick. No callback on programmatic popup opening. Safe popup DOM uses textContent for all original attributes, source attribution, full WGS84 coordinates and dated-snapshot/non-live/non-legal-status caveats.

The module reuses renderPointLayer + LayerScene + RBush without touching explorer startup or shared styles. The scene adapter sets private per-path canvas renderers before map attachment, leaving village SVG unchanged. Private panes z450/460 sit above default overlay400 below popups700. Canvas has pointer-events:none so blank rectangular areas do not intercept village SVG. Map-container capture hit-tests real interactive paths only and stops record clicks before underlying village select. Mousemove/mouseover only stop on record hits; wheel and pan are not intercepted. Cluster markers retain Leaflet keyboard behavior. Canvas is keyboard focusable: arrows cycle all rendered interactive shapes and Enter/Space opens the chosen record/cluster; no SVG record paths exist to tabindex individually. This isolates Leaflet1.9 private _drawLast/_drawFirst/_containsPoint usage; revalidate after Leaflet upgrades.

Browser selectors:
- input[data-record-layer="ID"] checkbox
- .record-layer-row[data-record-layer="ID"] row
- [data-record-status="ID"] status with exact numeric data-count
- .record-popup opened feature attributes

Verification: node --check module and node --test tests/village-record-layers.test.mjs tests/rendering.test.mjs passed 12/12. Tests cover concurrent/cache/uncheck/destroy races, explicit retry, malformed definitions/GeoJSON, complete160001-record acceptance and250 overlapping records retained by shared gridGroups. Browser lifecycle/hit-test behavior belongs to parent integration tests; no build/commit/deploy performed here.

Parent review: popups show original source fields with friendly tree labels, not underscore-prefixed derived search/index helpers. Layer rows show date-only retrieval metadata and a color swatch; full original metadata remains in the published catalog. Browser gate covers all seven sources, no eager fetch, 503 retry, cache reuse, uncheck-during-load, real-pointer clean-bin query, keyboard/tree-cluster drilldown, mobile panel scrolling and existing village regression.
