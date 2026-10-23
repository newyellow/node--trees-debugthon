# Explorer park candidate boundaries

Implemented as an independent Leaflet group/pane, not part of the exclusive
points/density/species LayerScene. Enable **公園輪廓 · 人工對照** then select an
official park, or click its existing official point marker (popupopen). Only the
selected park's candidates are drawn and fitted. Turning outlines off clears this
group only; the existing global data-overlay toggle also hides the outline pane.
All geometry goes through Leaflet GeoJSON, preserving Polygon holes/MultiPolygon.
No dependency was added. No imagery, story, service, production dist or existing
snapshot files were changed.

## Source / bounded coverage

Separate new file: public/data/park-boundaries-osm.geojson (861,990 bytes).
One real request to https://overpass-api.de/api/interpreter on 2026-10-23;
OSM database timestamp 2026-10-23T15:19:39Z, fetched 15:21:40.759Z.
BBox [west,south,east,north] = [121.45,24.95,121.67,25.21] covers Taipei urban
parks and neighboring portions of New Taipei, NOT a municipal clip or full Taipei
mountain extent. OSM leisure=park closed ways and multipolygon relations only.
Features crossing the bbox are retained in full; query bbox is not geometry bounds.
This is a community map snapshot, **not official/legal park boundaries**.
© OpenStreetMap contributors, ODbL 1.0:
https://www.openstreetmap.org/copyright and https://opendatacommons.org/licenses/odbl/1-0/.
The snapshot metadata retains query, endpoint, converter version and source date;
every candidate retains OSM identity, object version, last-edit timestamp and names.
The UI links each OSM object and shows source/version/date.

Raw query elements: 1,556; retained features 1,555 = 1,400 Polygon + 155 MultiPolygon,
with 13 inner rings. Relation/16809833 was skipped (unsupported relation members).
Converter supports complete way-based outer/inner relations, reverses/joins members,
assigns holes only to one containing outer. Unsupported/incomplete relations fail
closed, with reasons; relation way members are suppressed to avoid double counting.
This is deliberately not a general-purpose OSM converter/topology repair tool.
Ring closure/finite WGS84 coordinates/type/unique ID/version checks run before atomic
single-file replacement. It does not prove topology or OSM mapping correctness.

## Matching contract and observed quality

812 unchanged official parks.geojson point records are the selection authority.
Normalize NFKC, 臺/台, spaces and middle dots; exact name/OSM alternate-name equality
plus point-to-polygon distance <=250m yields a candidate. Also surface polygons
containing the official point but with a different name, always as ambiguous.
Distance uses a Taipei-local fixed metre approximation (100900 m/longitude degree,
111200 m/latitude degree), suitable for candidate screening, not surveying.
One candidate with equal name: matched candidate; multiple candidates OR name
mismatch: ambiguous; none: unmatched. No fuzzy name/nearest-only auto-match.
Observed: **494 matched candidates, 109 ambiguous, 209 unmatched** (sum 812).
These are matching statuses, not human/official verification or accuracy rates.
Official point placement, OSM naming, incomplete leisure tags, bbox/mountain coverage,
sub-parks and multipart mapping explain potential misses/ambiguities.
No road-derived blocks/fallback implemented: this requires separately validated road
network/topology evidence. Unmatched stays unmatched; no invented boundaries.

## Browser-local review

Buttons confirm/reject individual candidates; none are pre-confirmed. Dashed amber
= candidate, solid green = confirmed locally, dashed red = rejected locally. Review
is solely localStorage key trees.park-boundary-review.v1 on this origin/browser.
Key includes official record identity/name/coordinate, snapshot version, OSM id and
object version; later snapshots do not silently inherit a previous confirmation.
Storage denial reports failure without claiming a saved decision. Clearing removes
all park reviews for this browser; export downloads JSON, explicitly local-only.
No server save, authentication, public consensus, official endorsement or shared
review is implemented. Different deployment prefixes on the same origin share the
same local key by design. Browser clearing/private mode may lose records.

## Manual refresh / checks

Use Node 24 runtime bin on PATH, from repository root:

    node scripts/prepare-park-boundaries.mjs

Never invoked by build/browser/map movement. One bounded POST with 90s server and
120s client timeout; no automatic retry. HTTP 429/Retry-After is surfaced. Wait for
the supplied delay/server recovery before a deliberate manual rerun; do not poll.
Successful response validates first then atomically renames only the new snapshot.
Existing official datasets and manifest are untouched. No raw data download cache
outside this derived, provenance-bearing public snapshot is required at runtime.

    npm test
    npm run build -- --outDir test-results/park-boundaries-build
    TREES_TEST_URL=http://127.0.0.1:5191/explorer/index.html TREES_STUB_TILES=1 node scripts/check-park-boundaries-browser.mjs

Serve staging only with existing serve package/config as in docs/multisite.md;
never overwrite dist. Prefix: build --base /review/ into
 test-results/park-boundaries-prefix-host/review; serve parent on loopback 5192;
run same browser gate with /review/explorer/index.html. No service/config edits.

Verification 2026-10-23: npm test 45/45; root and prefix staging builds pass;
new desktop/mobile gates pass selection/outline visibility, local confirm/reject,
reload persistence, reset/export, exclusive-mode coexistence, global overlay toggle,
static snapshot HTTP failure/manual retry, no Overpass calls, base-prefixed fetch.
Root/prefix screenshots: test-results/park-boundaries-{desktop,mobile}[-prefix].png.
Root existing general, analysis, incremental, species browser suites pass using real
unchanged datasets with remote tiles stubbed. Provider availability is not claimed.
Detailed logs: test-results/park-*.log; exported review JSON also in test-results.
No deployment, git commit or push performed; independent parent review is still needed.
