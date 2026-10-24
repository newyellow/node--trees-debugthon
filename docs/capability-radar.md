# Capability radar module

Owned files: src/workspaces/02/capability-radar.js, src/workspaces/02/capability-radar.css, tests/capability-radar.test.mjs, docs/capability-radar.md.

## Integration

Import createCapabilityRadar from './capability-radar.js' and explicitly import './capability-radar.css' in the parent UI. Mount the returned figure with append/replaceChildren. No implicit mount, stylesheet import, fetch, listeners, storage or teardown. Each call creates an independent subtree with cryptographically unique SVG title/description IDs (browser crypto.randomUUID).

Signature: createCapabilityRadar({axes, size=180, compact=false, label='能力概覽', missingAtZero=false}) => HTMLElement.

axes is an ordered array of at least three {key, label, emoji?, color, value} entries. Numeric finite values in inclusive 0–100 are scores. null, undefined, strings, nonfinite and out-of-range values are missing, never coerced/clamped to zero. Size must be finite >0 and <=10000 CSS pixels. Unsupported axes/dimensions throw TypeError/RangeError. Colors support #RGB/#RRGGBB, otherwise safe #53666f. Caller labels and emoji use textContent only, never HTML. Optional string emoji is preserved by geometry and replaces numeric identifiers on spokes and in the legend; omitted/empty emoji falls back to the 1-based number. Caller chooses meaningful emoji and ordering; no domain rules are hardcoded here.

### Village six-axis opt-in

Pass all six village axes, including native/bird with value:null, and explicitly set missingAtZero:true. Attach meaningful emoji to each axis. This is a display-only policy: missing measurements remain null, complete remains false, and neither scores nor rankings change. Missing vertices display at zero radius, with dashed missing spokes, a dashed low-opacity display polygon, center outlined crosses, and explicit N/A spoke labels plus full-label N/A legend entries. Real zero remains a solid score point; center missing outlines are transparent and drawn above it. The description and visible caption explain that center N/A is NOT an actual zero score or a complete assessment.

Only boolean true enables this policy. Default/false preserves generic missing semantics: missing point and displayPoint are null, marker is at the spoke endpoint, no filled polygon for incomplete data, and only adjacent measured points connect, including cyclic last/first adjacency. Never bridge gaps by default.

## Reading and accessibility

Fixed 240×240 SVG viewBox scales to requested width, capped at container width. Spoke identifiers are emoji when supplied, numeric otherwise. Visible legend always keeps full labels and exact unrounded scores or N/A. Compact mode (e.g. size:110) visually hides the caption but retains complete accessible text; identifiers and N/A stay visible. Parent provides visible explanatory context for compact-only charts.

SVG role=img references its unique title/description. Description and caption identify units as snapshot-relative 0–100 scores, NOT ecological health. Solid points represent measured scores including zero; outlined crosses represent missing values. All-zero scores are valid, producing a degenerate center polygon. Single-known/all-missing cases work in either policy. This module does not compute domain scores or ecological-health judgments.

## Pure geometry API

computeRadarGeometry(axes, {size=180, missingAtZero=false}={}) is DOM-free, deterministic and does not mutate input. Returns {size,center,radius,axes,complete,missingAtZero,rings,polygon,displayPolygon,segments}.

- center: {x,y}; radius: size*0.30. Equally spaced clockwise angles begin at -PI/2.
- axes: normalized {key,label,emoji,color,value,angle,end,labelPoint,point,displayPoint}. emoji defaults to ''. Missing value/point remain null in BOTH policies. end is the 100-score spoke endpoint, not a measurement.
- displayPoint: measured point when valid; center when missing and explicitly opted in; otherwise null.
- complete: true only when ALL measurements are valid; opt-in never changes completeness.
- rings: four coordinate arrays at 25/50/75/100.
- polygon: measured points only when complete; otherwise null, including opt-in.
- displayPolygon: complete measured polygon, or all ordered display points when opted in; otherwise null. Not evidence of complete measured data.
- segments: adjacent valid measured points only; opt-in never introduces fabricated measurement edges.

Geometry size controls coordinate scale; DOM uses fixed geometry for scalable type/markers.

## Verification

Verified Node v24.22.1 at /Users/piyellow/Library/Application Support/TreesDebugthon/node-v24.22.1-darwin-arm64/bin/node. Run node --test tests/capability-radar.test.mjs.

Original seven pure tests are preserved. Added coverage for six axes/emoji, explicit opt-in vs unchanged default, invalid inputs remaining null, real zero, all-missing/single-known/all-zero display polygons, frozen caller input/options and deterministic independent output. Render tests use a minimal DOM double to check safe text insertion, emoji/numeric fallback, exact scores/N/A, display-only description, dashed missing polygon class, center crosses and solid zero points. Browser layout, app build/integration and publication remain parent-owned.
