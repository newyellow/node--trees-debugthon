# Cached12 RGB candidate comparison (experimental, not an accuracy optimization)

2026-10-24. Public baseline unchanged. Only local same12 cached PHOTO2 tiles were read; all original byte SHA256 and byte lengths matched public/data/vegetation/pilot.json. No downloads, installs, models, uploads, geometry edits, build, commit or deployment. Full provenance, per-tile counts, source/mask hashes and timings: private test-results/vegetation-comparison/comparison.json. Private masks are 1024×768 row-major u8 (0 background, 1 green, 255 nodata/unknown; separate valid and unknown planes disambiguate). private-mosaic.png has an untouched original panel with original watermarks plus diagnostic masks; never publish this raw-imagery preview.

## Measurement contract

Concept is RGB visible-green candidate, not canopy/grass discrimination, natural vegetation, tree count, roof material, or planting suitability. No roof inference. Green artificial paint remains a known false-positive risk; there are no calibrated probabilities. No real truth was supplied: evaluation API deliberately not called, accuracy/precision/recall/IoU unavailable. Synthetic tests validate mechanics only. Counts and changes below are descriptive, not improved accuracy.

## Reproducible method and explicit provenance

Version normalized-rgb-experimental-v1. Baseline imports existing isGreen without modification: alpha>0, G>35, G>1.10R, G>1.06B, 2G−R−B>18. Source hash 3e6f4ea610cfba7411650587b58d0f6e039a2f16e2e6536ef4669a264bbc6ab3; baseline geometry hash d321e1f5e1ea1af3d9b624fbdd7140b18a7704613b28052aa948440400775b8d. Pilot JSON hash 16535c84994d4a91440ada8fc4c06dc8d0423f32af4c15b58e07349640df66d5.

Parameters were explicit conservative engineering choices frozen before running the pilot, NOT fitted/validated thresholds or literature-optimal values. Motivated by canopy-review.md normalized color/shadow recommendations, roof-review.md artificial-surface caution and evaluation-protocol.md abstention policy:

- ExG=(2G−R−B)/(R+G+B); GLI=(2G−R−B)/(2G+R+B), zero denominator gives zero. Indices are brightness-normalized, but unknown floor intentionally is not.
- Alpha-zero or explicit invalid support is nodata. Original HSV max-channel V<=40 or saturation<0.12 is unknown, never forced background. Gray surfaces are deliberately over-abstained, not claimed shadow detection.
- Known-pixel HSV hue 65–170 degrees inclusive; strong ExG>=0.12 AND GLI>=0.08; weak ExG>=0.06 AND GLI>=0.04.
- Optional single 3×3 RGB box mean accepts only original-known valid neighbors with max channel distance<=24 from center; center always participates. No smoothing into nodata, shadow/gray unknown or large color edges. It is a small edge-aware experimental mean, not a validated bilateral filter.
- pre is strong pixel mask; post promotes weak pixels only with >=2 strong original-pre neighbors in 3×3. Synchronous one pass, no iterative propagation. Rationale: permit weak local green support without erasing isolated strong small structures or unconditional hole-filling. No Otsu, closing, minimum-size deletion or global foreground fill. Non-green guard and unknown gaps remain barriers; weak green-painted roads can still be mistaken and need truth.
- Radius one display sample ~0.2705m; 3×3 footprint ~0.8115m from known display sampling, NOT native GSD. Native GSD/capture date stay null.

**pre/post here are local-support ablation stages, NOT evaluation protocol's production 3m² component filter stages.** No claim of production-equivalent filtering, polygon area, study clipping, or evaluation-ready masks. Four-connected component/3m² topology is unchanged and not reimplemented. If real truth is later supplied, prepare production-equivalent study-clipped projected pre/post masks using existing geometry before evaluating; do not pass these post arrays as production-filtered.

## Observed full-grid counts

All methods: 786,432 valid pixels; alpha nodata 0. Candidate unknown 657,793 (83.64%); known 128,639. This very high abstention and severe reduction are reasons NOT to adopt the candidate or claim optimization. Baseline green-on-candidate-unknown = 5,060, reported separately rather than mislabeled losses.

| Method | Full green pre | Full green post | Approx post m² | Gained / lost vs baseline on candidate-known support |
|---|---:|---:|---:|---:|
| Existing isGreen | 18,105 | 18,105 | 1,324.78 | reference |
| Normalized | 540 | 864 | 63.22 | 4 / 12,185 |
| Normalized + edge mean | 448 | 650 | 47.56 | 0 / 12,395 |

Areas above are explicitly approximate display-sample count × 0.2705036376068301², on the full rectangular grid, NOT EPSG:3826 projected study-clipped area. Full-grid approximate 57,544.97m² differs from pilot's clipped projected 57,291.13m²; do not substitute it in coverage/UI. Unknown approximate 48,132.17m²; known 9,412.80m². Watermark obstruction has not been manually labeled: valid means alpha coverage only, not verified interpretable semantics. Original panel preserves all marks; watermark exclusion area remains unavailable, not zero.

First bounded run: Chrome 156.0.8078.48, Node v24.22.1, decode/startup 4.006s, normalized compute 179.9ms, smoothed 216.7ms, total including private previews/stats ~10.99s. Node peak RSS ~1.62GB (includes serialization overhead; NOT whole Chrome process-tree memory). One run, not benchmark confidence intervals. CPU work bounded to 786,432 pixels and fixed 3×3 passes; image network requests blocked by browser route and no cache client/fetch fallback exists. Preview serialization is memory-heavy despite small compute time.

## Reproduction and verification

Using existing Node binary (no installs):

    NODE='/Users/piyellow/Library/Application Support/TreesDebugthon/node-v24.22.1-darwin-arm64/bin/node'
    "$NODE" --test tests/vegetation/candidates.test.mjs
    "$NODE" scripts/vegetation/compare-cached.mjs

Runner fails closed for missing bytes, SHA/size mismatch, wrong pilot IDs/grid, or unexpected 256×256 decode. Private output only under test-results/vegetation-comparison/. Source and mask SHA256 values recorded every run; timings may vary. 8/8 synthetic tests passed: brightness normalization, black/gray/shadow unknown, transparent/explicit nodata, neighbor exclusion, isolated structures/gaps, bounded weak support, exact baseline, deterministic frozen parameters and malformed/bounds checks. Painted-green fixture explicitly demonstrates unresolved false positive.

No human labels, held-out score, external validity, confidence calibration or parameter selection occurred. Recommendation: retain public baseline and acquire authorized independent human review before choosing thresholds or claiming improved canopy accuracy; do not expand imagery based on these descriptive counts.


## Review correction: rejected v1, separate baseline-preserving v2

The v1 strict replacement above is a **rejected ablation**, not completed detector optimization. Its mask outputs remain byte-identical after memory-only refactoring. Visual reviewer feedback reports rejected natural low-saturation crowns; this is reviewer observation, not independently labeled accuracy. Current candidate source hash supersedes the initial historical hash above: 9bc7c9c1a08047536950545fd9918bfbfbb844d4370692352ae0ad53653a8351. Current runner hash ea35f669b5c339fb682e519f97986723beff3e3e7a496f3652473116f6e262c9. Historical first-comparison.json preserves initial results; current comparison.json contains all three candidate outputs and gate diagnostics.

Reason-specific original unsmoothed v1 gate failures, **overlapping counts, not additive**:

| Gate | All alpha-valid | Existing baseline-green |
|---|---:|---:|
| V<=40 | 0 | 0 |
| saturation<0.12 | 657,793 | 5,060 |
| hue<65 | 350,078 | 0 |
| hue>170 | 308,409 | 0 |
| ExG<0.12 | 785,892 | 17,565 |
| GLI<0.08 | 785,130 | 16,804 |

Thus hue does NOT explain baseline rejection on this pilot; the strong normalized thresholds reject most baseline pixels, with low saturation additionally causing large abstention. Baseline saturation histogram: <0.04 = 0; [0.04,0.12) = 5,060; [0.12,0.25) = 13,043; [0.25,0.5) = 2; >=0.5 = 0. Hue histogram edges [45,65,90,120,170,180,361] and counts [0,0,24,3846,14235,0,0]. Baseline is not truth: these histograms diagnose compatibility, not optimal thresholds. No threshold grid or winner selection was performed.

### New fixed unvalidated experiment

Version **baseline-preserving-hysteresis-v2**, independent from v1. Exact original isGreen seeds are always preserved, even when dark/low-saturation. No claim that retained baseline is known vegetation truth. Nonbaseline V<=40 or saturation<0.04 is ambiguous unknown; gray is NOT automatically called shadow. Native GSD and capture date remain unknown.

Fixed engineering parameters (not fitted against truth): weak ExG>=0.035 AND GLI>=0.025; hue 45–180 inclusive; G>=1.015R AND G>=1.015B. Such weak pixels are promoted only with >=2 **cardinal original-baseline** neighbors. Radius=1 display pixel (~0.2705m); connectivity=4; exactly one synchronous pass. Original baseline seeds, never newly promoted pixels, provide support, so no iterative propagation, all-foreground fill, or jumping diagonal nodata/unknown gaps. No smoothing for v2. Dark/ambiguous unknown and nodata are never promoted. Thin gaps satisfying weak green still may be wrongly bridged; painted-green structures remain unresolved false-positive risk. These choices improve baseline compatibility by construction, NOT measured ecological accuracy.

| Method | Retained original baseline | pre green | post green | gained / lost on known support | unknown |
|---|---:|---:|---:|---:|---:|
| Rejected v1 | 860 / 18,105 | 540 | 864 | 4 / 12,185 | 657,793 |
| Rejected v1 + mean | 650 / 18,105 | 448 | 650 | 0 / 12,395 | 657,793 |
| Baseline-preserving v2 | 18,105 / 18,105 | 18,105 | 19,668 | 1,563 / 0 | 378,457 |

V2 all-valid 786,432; nodata 0; known 407,975; baseline-on-unknown 0. Full-grid approximate display post area 1,439.15m²; gained approximate 114.37m²; unknown approximate 27,692.54m². Same nonprojected/full-grid caveats apply. No calibrated probability, precision/recall, canopy/grass separation or roof inference.

V2 post SHA256 c0d289a975e6c5a54a12e3ae682a95b28c993ca6ec6955ec484a370eb71e4085; baseline SHA256 443b42c6e27556ec4d8db9c72e75e01911d447dcfe8aa8864f2c782e56edb71a. All twelve input hashes are reverified on every run; no additional imagery read.

Revised private preview includes untouched original, exact baseline, rejected v1, rejected smoothed v1, and new v2. Per-pixel objects removed from v1; preview transfers base64 one panel at a time rather than huge number arrays. Revised first run compute v1 97.1ms / smoothed 144.8ms / v2 21.9ms; total 5.064s; Node peak RSS 595,771,392 bytes (~0.60GB vs initial ~1.62GB), excluding Chrome process-tree memory. Timings are descriptive single-run observations, not controlled benchmark claims.

13 candidate synthetic tests / 32 total vegetation tests passed. New contracts cover preservation of all baseline including low-saturation/dark seeds, weak pixel recovery with fixed seed support, invalid/nodata/unknown barriers, boundary behavior, noniterative growth, and gate histogram accounting. No public baseline edits, build, commit or deployment; actual accuracy optimization remains unproven pending independent human annotations.

