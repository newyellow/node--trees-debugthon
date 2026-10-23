# Capability radar module

Owned files:
- src/workspaces/02/capability-radar.js
- src/workspaces/02/capability-radar.css
- tests/capability-radar.test.mjs
- docs/capability-radar.md

## Integration

Import createCapabilityRadar from './capability-radar.js' and explicitly import './capability-radar.css' in the parent UI. Mount the returned HTMLElement with append/replaceChildren. No implicit mount, stylesheet import, data fetch, map dependency, listeners, storage or teardown is needed. Each call creates an independent subtree and cryptographically unique SVG title/description IDs (modern secure-context browser crypto.randomUUID).

Signature: createCapabilityRadar({axes, size=180, compact=false, label='能力概覽'}) => HTMLElement (figure).

axes is an ordered array with at least three entries: {key, label, color, value}. Values must be numeric finite scores in inclusive 0–100. null, undefined, strings, nonfinite and out-of-range values are missing, never clamped or coerced to zero. Size is a finite number >0 and <=10000 CSS pixels. Unsupported axis counts and dimensions throw TypeError/RangeError. Caller colors support #RGB/#RRGGBB; other paints use safe #53666f. Labels are inserted through textContent, never interpreted as HTML.

For the current village UI pass ONLY its four scored capability axes, in the desired stable order, with caller palette and scores. Native/bird unavailable indicators remain explicit parent N/A badges; do not feed fabricated zeros or substitute axes. This module also supports generic incomplete arrays for other hosts.

## Reading and accessibility

The fixed 240×240 SVG viewBox scales to requested width, capped at container width. Default view uses numbered clockwise spokes (first at top) plus a visible ordered legend containing the complete, untruncated caller labels and exact scores. This keeps long source labels readable without overlapping the polygon. Compact mode, e.g. size:110, visually hides the caption but retains the complete accessible text; numbered spokes and N/A indicators remain visible. Parent should provide visible explanatory context for compact-only charts.

SVG role=img references its own title and description. Description and textual caption identify units as snapshot-relative 0–100 scores, NOT ecological health. Real zero is a solid point at center. Missing values use dashed spokes and an outlined cross at the spoke end labelled N/A; this is a missing marker, not a numeric point. Filled polygon exists only when every axis is valid. Otherwise only known points and adjacent known-to-known segments are drawn, including the cyclic last/first adjacency; never bridge across a missing axis. All-zero values are valid and yield a degenerate center polygon; single-known/all-missing cases are supported.

## Pure geometry API

computeRadarGeometry(axes, {size=180}={}) is DOM-free, deterministic, and does not mutate input. Returns {size,center,radius,axes,complete,rings,polygon,segments}.

- center: {x,y}; radius: size*0.30; equally spaced clockwise angles in radians starting -PI/2.
- axes: normalized {key,label,color,value,angle,end,labelPoint,point}; missing point/value are null. end is always the 100-score spoke endpoint, not a measurement.
- rings: four coordinate arrays at 25/50/75/100.
- polygon: ordered points only when all scores valid, otherwise null.
- segments: [{from,to}] for adjacent valid axes only; no missing-value fill.

Geometry size controls coordinate scale; DOM uses fixed geometry for scalable type and markers.

## Verification

Node 24.22.1: node --test tests/capability-radar.test.mjs — 7/7 pass. Covers symmetry, rings, endpoints, real/all zero, invalid/missing coercion, wraparound gaps, single/all missing, 3–100 axes, sizes 1/110/180/320/10000, finite coordinates, safe colors, input preservation and invalid arguments.

Ephemeral Playwright/installed Chrome smoke (no saved files, requests or dependency installs): six simultaneous default/compact/partial/zero/single-known/all-missing instances; expected fill counts [1,0,1,1,0,0], unique IDs and valid ARIA references, literal malicious-looking labels, exact accessible zero score, 110px compact SVG, no horizontal overflow at 390px, no page errors. Passed. Whole-app build/integration and publication remain parent-owned.
