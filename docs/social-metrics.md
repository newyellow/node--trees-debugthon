# Social demo metrics v1

UI: import applySocialMetrics from ./social-metrics.js; after existing village-game byte verification call game = applySocialMetrics(game, metrics), fetching data/social-metrics.json. Synchronous returns NEW game/villages/scores, leaves source unchanged. Throws before returning any enriched game on invalid identity/counts/scores. Module pins expected village-game SHA/snapshot; loader must retain actual byte verification.

v.socialMetrics = {id,native:{total,matched,unlisted,unknown,dead,coverage},birdInsect:{simulated:true,score},activity:{simulated:true,windowDays:7,dueCount,reportedCount,rate},scores:{nativeShare,birdInsect,activity}}. Added scores copied to v.scores, original three unchanged. game.socialMetrics holds global metadata without villages. metrics.villages is an array of456 exact IDs.

Six scored CAPABILITIES/RADAR_CAPABILITIES: treeDensity, protectedDensity, richness, nativeShare, birdInsect, activity; labels carry PROXY/DEMO; activity emoji 📣. RATING_POLICY equal-six-capability-demo-mean-v1 with all weights1; partial caller objects still exclude invalid axes.

Native is blueprint-native PROXY: exact speciesName-normalized union of all four supplied blueprint regions (19labels), no aliases/taxonomic inference. Unlisted labels are assumed non-native FOR DEMO, NOT botanical conclusions. Denominator ALL assigned managed-tree records, including unknown/dead. matched/total*100, never cohort percentile; zero=>0. coverage=(total-unknown-dead)/total. unlisted excludes unknown/dead; nonmatch categories explicit.

Source researcher 洪睿晉 per user attribution; authorship/date/publication not printed on image; unverified proposal. Only compact names/attribution/source-record hash/public provenance policy redistributed, no image/full transcription. Attribution is not image reproduction license.

Bird/insect is seeded synthetic0–100, not observations/absence. Activity is assigned 7-day DEMO: dueCount=all managed records, integer reportedCount<=dueCount, rate=reportedCount/dueCount*100 (zero=>0). NOT actual reports/uploads/accounts/volunteer activity. Version/seed/window pinned; actual preparedAt is not refresh time. FNV-1a UTF-16 seeded by metric key/village ID.

Node24: node scripts/prepare-social-metrics.mjs (offline only). Verifies pinned local source record SHA, existing manifest/regions/tree GeoJSON SHA against village-game pins and snapshot, uses exact positional membership. No source rewritten. Missing/bad hashes, ID/count errors, nonconservation fail closed. Independent tests recompute native counts for all456 from source features.

## Prepared snapshot / acceptance

Actual preparation 2026-10-24T04:27:55.871Z; no retrieval/refresh. Artifact totals:162,321 assigned records =24,618 exact blueprint matches +137,678 unlisted known labels +18 unknown +7 dead-status. Whole source162,369 =assigned162,321 +48 unassigned. These are records, not unique biological individuals. The19-name union applies identically to every village; never filtered by district/blueprint region. Existing original three scores remain fixed-cohort relative scores; nativeShare and activity are direct percentages, birdInsect seeded synthetic score.

Node24 complete unit suite:168 tests,167 pass,0 fail,1 pre-existing skip. Dedicated adapter/source/native/demo/rating/radar tests pass; each of456 native counts independently reconstructed from hash-verified original source features. Zero-tree native/activity score is0. Tests reject missing/all-zero/mismatched hashes, version/seed/snapshot drift, duplicated/missing IDs, altered count/coverage/score/simulation/proxy policy. Original source scores, village data, and artifact objects remain unchanged by adapter. Browser/build verification belongs to integration owner.
