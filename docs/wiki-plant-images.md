# Wikipedia / Wikimedia species reference thumbnails

Only used when FloraAPI safeImage rejects the photo, or a permitted FloraAPI image actually fails. Working API images never trigger lookup. Unknown scientific names and known Lantana identity contradictions do not look up. This does not change native flags, scoring, recommendation eligibility, local-photo behavior or global safeImage.

## Identity and policy
- Exact scientific-name Wikipedia title (redirects permitted), one non-disambiguation page with Wikidata item; require exactly one non-deprecated P225 value equal to the supplied scientific name. No search, common-name matching or arbitrary gallery image.
- Only that article's free pageimage is resolved against Commons imageinfo/extmetadata. Missing / ambiguous identity or metadata leaves the original placeholder.
- HTTPS without credentials; endpoints fixed to en.wikipedia.org, www.wikidata.org, commons.wikimedia.org. Source restricted to commons.wikimedia.org; thumbnails restricted to upload.wikimedia.org or thumb.wikimedia.org and /thumb/ URLs.
- Require author credit, Commons source and matching creativecommons.org license URL. Accepted CC BY, CC BY-SA, CC0; public domain additionally requires explicit Public domain label, Copyrighted=False and the Creative Commons publicdomain/mark/1.0 URL. Generic PD is not accepted. Metadata is plain text via textContent, never inserted HTML.
- Request iiurlwidth=300, reject metadata thumbwidth >300. Current Wikimedia returns a bucketed **330px filename** for requested/logical 300px width (thumbwidth=300); use the returned official thumbnail, never the original/full-resolution URL or responsiveUrls. No image blobs, downloading, persistent cache or upload.

## Bounds and lifecycle
IntersectionObserver defers work until figures approach view. A render session limits lookup to twelve figures; resolver runs two chains concurrently, deduplicates taxa, stores at most 48 in-memory results. Session cancellation disconnects observers, aborts unused work and rejects late DOM updates. Timeout for each full lookup chain is at most 12 seconds. 429 Retry-After controls shared cooldown; 503 and 429 never retry automatically. GET only, credentials omitted, no referrer, no user photos or other user data transmitted.

## Validation (2026-10-24)
- node --test tests/wiki-plant-images.test.mjs: seven tests pass (identity mismatch/homonym/disambiguation, unsafe/missing license, cache/dedupe, abort, concurrency, 503/429/cooldown).
- node scripts/check-wiki-plant-images.mjs: mock desktop 1280 + 390, missing-photo fixture, real planner API-photo error, healthy-photo no fallback, stale session and Flora panel cancel pass.
- node scripts/check-wiki-plant-images.mjs --live: actual browser CORS GETs all 200 for Ficus microcarpa → Q714180 → File:Ficus microcarpa - La Gomera 01.jpg. P225 exact match; H. Zell, CC BY-SA 3.0, https://creativecommons.org/licenses/by-sa/3.0. thumb.wikimedia.org image successfully decoded. No actual network blocker.
- Screenshots/evidence: test-results/wiki-images/{mock,live}-{desktop,390}.png and {mock,live}-evidence.json (ignored artifacts, not shipped).
- Vite build passes with --outDir test-results/wiki-images/build, preserving production dist.

Existing planner mock gate's missing-image species names (Unknown plant etc.) now could initiate a Wikimedia request when visible. For a strictly hermetic existing gate, parent may add an empty Wikimedia API route to scripts/check-native-planner-browser.mjs; that file was outside this child's write scope and is unchanged. Its FloraAPI request-count assertions remain unchanged by Wikimedia GETs.
