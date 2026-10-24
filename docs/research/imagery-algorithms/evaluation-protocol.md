# Cached12 mask evaluation protocol (no measured accuracy yet)

## Scope and measurement contract

This is an offline evaluation harness, not a selected replacement algorithm. No new imagery, model downloads, installations, uploads, cloud inference, geometry changes or deployment are performed. All test fixtures are **synthetic**. No independently annotated pilot truth has been supplied; passing tests proves arithmetic and validation behavior, not canopy accuracy.

Freeze the SAME PHOTO2 z19 pilot: x439181–439184, y224446–224448 (12 tiles), 256×256 each, in docs/vegetation-pilot.md. ID convention is z/y/x, e.g. 19/224446/439181. Keep original cached bytes and watermark, record original SHA256, annotation version/reviewer log, original source/capture metadata (unknown stays null), CRS, study mask, pixel grid origin, dimensions, model version, parameters and seed. Do not expand to other cached tiles. Display sampling is not native GSD. No claims for whole Songshan/Xinyi or unseen dates/sites.

| Concept | Observation/unit | Denominator/limits |
|---|---|---|
| Visible canopy footprint | Human interpreted overhead crown mask; pixels and projected m² | Known, valid annotated support only; not tree count/species/height |
| Low vegetation | Visible low vegetation interpretation | RGB may not resolve height; uncertain pixels excluded |
| Roof candidate | Visible roof-like outline | Shape hypothesis only, not roof material or plantability |
| Segmentation agreement | Pixel confusion, class IoU/F1 | Same candidate-independent evaluation support |
| Area agreement | Predicted vs truth projected m² | Truth area; zero truth yields null relative error |

## Human annotation, uncertainty and adjudication

Create masks independently of algorithm predictions at the original aligned grid. Two reviewers annotate all 12 tiles independently, blind to model outputs and each other's first pass. Version the rubric before labeling. Never auto-convert RGB output into truth. A tile is a storage unit, not an independent replicate.

- **canopy**: visibly interpretable overhead woody crown footprint, including discernible non-green canopy. Follow visible crown boundaries, not buffers around tree points. Do not infer occluded crowns through buildings/shadow.
- **lowveg**: visibly interpretable grass/herb/low vegetation. If canopy vs low vegetation cannot be reliably resolved from RGB, mark unknown rather than decide by green color alone. Low shrubs without reliable height evidence remain uncertain.
- **roofCandidate**: discernible roof-like surface/outline. A green roof can have vegetation on top: use separate annotation layers when roof and vegetation overlap. A single multiclass experiment must specify a frozen precedence rule (e.g. visible vegetation first); do not pretend mutually exclusive masks encode both tasks. Roof **shape does not establish material, load capacity, ownership, access, drainage, planting suitability or plantability**.
- **materialUnknown**: visible artificial/roof-like object with unresolved material or green paint vs vegetation ambiguity. Excluded from semantic scores, never forced to vegetation/background or called a verified roof material. This does not mean every interpretable roofCandidate must be excluded: roof-shape and material are different questions.
- **shadowUnknown**: shadow/occlusion prevents reliable interpretation. Do not label every dark patch background or infer hidden vegetation.
- **background**: confidently interpreted non-target surface under this experiment's rubric; never a catch-all for unannotated pixels.
- **nodata / unknown**: alpha-zero, missing coverage, unreviewed pixels, watermark obstruction or unresolved class. Mask out explicitly. Preserve source marks; exclude obstructed pixels rather than erase them.

Review seam-spanning crowns as a mosaic; align the exact same pixel grid without smoothing/reprojection drift. Keep original reviewer masks, disagreement map and adjudication notes. A third reviewer adjudicates disagreements without model scores. If disagreement persists, mark unknown. Report inter-reviewer confusion/IoU on their common known support **before** adjudication, unknown/abstention fractions, boundary uncertainty and how many pixels were adjudicated/excluded. Optionally publish a separately labeled boundary-tolerance sensitivity analysis; do not replace primary exact-grid scores with it. High agreement does not validate RGB visibility assumptions.

## Deterministic stratified spatial holdout; no tuning on test

1. Freeze the 12 source IDs/hashes, annotation protocol, model shortlist, metrics, 3m² filtering rule, spatial grouping, seed and split manifest **before inspecting candidate test scores**.
2. Group overlapping chips, augmentations, repeated views, seam-crossing connected objects and their source tiles into whole spatial blocks. A source tile/connected target cannot appear in multiple partitions. No random pixel split and no chip split that distributes one tile across train/validation/test. Extend groups or ignore a boundary band where a target spans groups.
3. Set broad block strata from frozen imagery/context metadata (e.g. built-up/vegetated/mixed), not candidate performance. Each stratum requires at least 3 independent blocks. Do not force a fine stratum where the pilot cannot support it. Metadata stratification does not create missing ecological diversity.
4. Use exported blockedHoldout(tiles, {seed, embargoEdges}). Each tile entry has unique string id, block, stratum. The function sorts blocks by seeded FNV-1a rank (lexical tie break) within strata, then assigns test/validation/train cyclically. Same inputs and seed give identical membership independent of tile order. It allocates whole blocks, not exact pixel proportions. Save memberships and hashes; never seed-shop for favorable results.
5. Supply every spatial-neighbor/overlap edge needing exclusion in embargoEdges as [blockA, blockB]. Use a preregistered distance/context buffer wide enough for crown extent, model receptive field and georegistration uncertainty; tile boundaries alone are not spatial independence. Lower-priority partition blocks become buffer (test > validation > train). Buffer tiles are not scored or tuned on. The helper validates edge references and refuses a resulting empty train/validation/test partition; it cannot infer missing spatial edges from IDs. Humans must verify block topology and buffers.
6. Tune thresholds, morphology, prompts, calibration and model choice only on train/validation. Lock code, dependencies, parameters, mapping and connected-component settings. Test is opened once after locking; report all preregistered candidates without selecting/tuning on those results. A change following test inspection requires a new genuinely unseen test set, not a renamed seed.
7. Twelve contiguous tiles may not leave three independent partitions after legitimate grouping/embargo, especially with large-context models. **If infeasible, report descriptive pilot agreement/calibration only, not held-out validation**. Do not weaken the buffer, fabricate ground truth, acquire more imagery or claim external validity to satisfy the split. Additional imagery/annotation requires separate authorization.

Uncertainty is clustered by spatial block, not millions of independent pixels. Report per-block/per-tile results and pooled counts. If independent test blocks are too few, avoid precise CIs; any later bootstrap must resample whole independent blocks with a frozen seed and report that limitation. Keep an untouched external region/date for later authorized generalization work.

## Metrics and denominator policy

For each known class use one-vs-rest TP/FP/FN/TN on common known pixels. Confusion rows = truth, columns = prediction, in explicit classes order. Precision = TP/(TP+FP); recall = TP/(TP+FN); F1 = 2TP/(2TP+FP+FN); IoU = TP/(TP+FP+FN). Any zero denominator is JSON null, not zero, one, NaN or infinity. In particular absent truth+prediction has null IoU/F1; false positives with no truth have precision 0, recall null, F1/IoU 0. TN is reported, but accuracy is not a substitute for minority canopy IoU.

Areas sum supplied positive finite projected pixel areas on the same support. relativeAreaError = abs(predictedAreaM2-truthAreaM2)/truthAreaM2; signedRelativeAreaError retains the sign. Both are null when truth area is zero. These are fractions, not percentages. Equal areas can hide spatial mismatch, hence always pair area error with confusion/IoU. Default evaluateMasks area=1 is useful for synthetic/unit-pixel tests only; the pilot API requires explicit scalar m²/pixel or an aligned per-pixel m² array. Derive study-clipped per-pixel area consistently in EPSG:3826 when needed; do not treat degree² as m² or assert exact area from approximate zoom scale.

Unknown/unmapped/nodata labels on **either** side are excluded, not negatives. The low-level function reports mutually exclusive exclusion counts in order invalidMask → unknownTruth → unknownPrediction. The multi-candidate pilot comparison uses the **intersection** of known truth, validity and all candidates' pre/post masks so all primary comparisons have identical support. It reports common support and each candidate/stage's abstention count over known truth. This can conceal hard pixels if a model abstains widely: publish coverage alongside scores, investigate large abstentions, do not rank by score alone, and do not add a new abstaining candidate silently after freezing support. No score at zero common support is evidence of success. Pooled metrics sum counts/areas before ratios, never average tile F1 values. No multiclass macro average is provided because missing-class handling would require an explicit additional policy.

## Pre/post minimum-area comparison

Supply BOTH pre and post arrays for every candidate. Pre means before the 3m² connected-component exclusion; post means after the exact production-equivalent rule: four-connected labeling on the assembled mosaic (not independent tile labeling), preserve holes/nodata, study clipping before projected area classification, retain area **>=3m²**, flag pilot-border truncation. Split/group seam-spanning targets before evaluation. The harness does **not** implement/rewrite filtering or verify arrays were truly produced by that process; record the producing code/hash in the run log. Do not mistake small-object removal for better detection.

For primary pre and post pixel metrics, keep the **same unfiltered human reference**, same ignored pixels and same common support; removed vegetation becomes background, never nodata. This exposes recall loss as well as reduced false positives. If a secondary minimum-mappable-unit reference is needed, derive and freeze it independently with the same area/clip policy and label the changed target explicitly. Do not compare a filtered prediction to a filtered truth without reporting the unfiltered task too. The existing geometry tests, not this harness, cover projected clipping and seam-preserving topology. Component/object-level matching is not implemented; pixel scores cannot prove object detection/counting quality.

## Local CLI/API contract

Run (Node >=24 already installed; no npm install):

    node --test tests/vegetation/evaluation.test.mjs
    node scripts/vegetation/evaluate-masks.mjs --help
    node scripts/vegetation/evaluate-masks.mjs /local/path/annotations-and-masks.json

CLI reads exactly one local JSON file and writes JSON to stdout; errors are stderr + nonzero exit. It never reads source imagery, fetches, creates output files, chooses a model or deploys. Caller may redirect stdout to an authorized path. The output includes input file SHA256; source hashes are **supplied provenance**, not verification against source bytes. Owner must compare them to cached12 originals. Exact IDs/dimensions prevent accidental expansion but do not prove masks are geographically correct.

Manifest structure (notation only, **not fabricated pilot labels**):

    {
      "classes": ["background", "canopy", "lowveg", "roofCandidate"],
      "truthMapping": {"0":"background", "1":"canopy", "2":"lowveg",
                       "3":"roofCandidate", "255":null},
      "predictionMappings": {
        "rgb-baseline": {"0":"background", "1":"canopy", "255":null},
        "candidate-name": {"0":"background", "1":"canopy", "255":null}
      },
      "tiles": [
        {
          "id":"19/224446/439181", "width":256, "height":256,
          "sourceSha256":"<64 hexadecimal characters from cached original>",
          "pixelAreaM2":"<positive number OR aligned array of positive numbers>",
          "truth":"<65536 row-major labels>",
          "validMask":"<optional 65536 booleans or 0/1; false outside study>",
          "predictions": {
            "rgb-baseline":{"pre":"<65536 labels>","post":"<65536 labels>"},
            "candidate-name":{"pre":"<65536 labels>","post":"<65536 labels>"}
          }
        }
      ]
    }

Supply all twelve unique IDs and identical candidate keys/stages for every tile. Arrays are JSON arrays, not strings as used in the notation. Mapping keys are stringified raw label values; absent keys/null map to ignored. Semantic unknown class names cannot be evaluated classes. There is no implicit 255 convention in the generic API: define mappings explicitly. A binary green heuristic cannot semantically distinguish canopy/lowveg: compare a separate frozen vegetation-vs-background task, or acknowledge its mapping is only a proxy. If roof labels are unavailable, omit the roof task rather than fabricate negatives. SAM supplies masks without inherent class semantics; DeepForest boxes are not canopy-area truth. Both need separately justified adaptation and validation before semantic mask comparison. scikit-image thresholding/segmentation/morphology documentation motivates candidates, not evidence that any candidate is more accurate here.

The CLI's pooled report covers **all supplied pilot tiles** and is descriptive, not automatically a test score. Use saved blockedHoldout memberships with exported poolEvaluations on the matching per-tile reports to obtain train/validation/test reports separately; exclude buffer. Do not use pooled-all12 results for model tuning once any tiles are locked test. For blinded operation, run/freeze predictions before the evaluator receives held-out truth, and restrict access to test output until final audit. Annotation access control is organizational; this arithmetic tool is not a security boundary.

## Evidence returned by this change

Four new files only: src/vegetation/evaluation.js, tests/vegetation/evaluation.test.mjs, scripts/vegetation/evaluate-masks.mjs and this protocol. Synthetic tests exercise confusion, absent classes, unknowns, multiclass weighted areas, pooling, malformed input, deterministic whole-block assignment, embargo refusal, exact12/common support and CLI usage. No new model selected and no real accuracy measured. No changes to geometry/prepare/UI/public/package/git index/dist; no commit or deploy.
