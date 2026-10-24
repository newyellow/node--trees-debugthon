# Site favicon

Authorized by Newyellow game message1563532238065377312 at2026-10-24 20:38, after UI4190be1 and GA5405c61.

Reuse the existing treeDensity (green-cover proxy) pixel-tree icon paths from src/workspaces/02/radar-icons.js, derived from the user-supplied Taipei Tree Radar Design Kit documented in radar-design-kit.md. No new external art, image-generation call, fonts or remote dependencies. Forest-green square backing with cream silhouette and lime highlights preserves contrast on light/dark browser chrome. SVG uses the original24-unit geometry and crispEdges; PNG is a locally rasterized32×32 RGBA fallback from the same SVG.

public/favicon.svg and public/favicon.png are copied by Vite. scripts/favicon.mjs injects exactly one PNG fallback and one SVG rel=icon into every configured HTML entry, including home and workspace02; no generated homepage edits are needed. Vite absolute and relative bases are respected (root /, nested /trees/, and ./ tested). Existing icon links are rejected to avoid duplicate integration. PNG precedes the preferred scalable SVG.

Scoped checks: node --test tests/favicon.test.mjs; TEST_DIST=<built-directory> node --test tests/favicon.test.mjs. Three checks cover base-aware links, identical source paths, PNG signature/IHDR32×32 RGBA, and all six built HTML references while retaining the single GA config. SVG also parses as XML; sips confirms PNG dimensions/format. Required build689ms. No application regression suite, GA collect test or inference call. Browser tab subjective visual acceptance remains with Newyellow.

## Pixel-green mosaic replacement — 2026-10-24 20:54
Supersedes the tree pictogram above under Newyellow message1563536202554937506. New SVG represents the homepage's pixelated green visual field: a6×6 logical grid (36×36 viewBox,6-unit square cells),23 colored squares with transparent gaps, using only colors found in public/assets/pixels.json. This is not6×6 raster output: fallback PNG is32×32 RGBA and SVG stays scalable/crisp. No tree path or external imagery remains. All six entries retain the same shared base-aware links, now with ?v=pixel-greens-1 cache bust. Scoped asset tests check logical-cell coordinates, palette provenance, PNG signature/dimensions, six-entry references and preservation of one GA config. SVG parses as XML; no old application suite or external analytics execution.
