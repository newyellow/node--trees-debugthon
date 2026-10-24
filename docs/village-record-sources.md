# Village record source publication

This adds independent point layers; it does not change tree snapshots, regions, the existing manifest, village scores, or prepare-village-game.mjs. No observations, network retrievals, coordinate geocoding, or nearby-point merging are performed.

## Offline reproduction

Run with Node 24 and existing dependencies:

    node scripts/prepare-village-records.mjs
    node --test tests/village-record-sources.test.mjs

Only test-results/village-sources/protected.csv and bins.csv are read. Missing caches fail with BLOCKED SOURCE_CACHE_MISSING; source-byte SHA mismatch fails with BLOCKED SOURCE_SHA_MISMATCH. Regions must also match village-game.json inputHashes. All inputs and audits are validated before writing; outputs are staged and individually atomically renamed, metadata last. This is not a filesystem-wide multi-file transaction. Repeated execution with unchanged inputs produces identical bytes. No download fallback exists.

## Source audits

| Layer | Raw | Invalid coordinates | Missing identity | Exact duplicates | Published | Assigned to village | Outside village polygons |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| protected-trees | 3874 | 0 | 0 | 0 | 3874 | 3871 | 3 |
| clean-bins | 661 | 2 | 0 | 1 | 658 | 658 | 0 |

Protected SHA-256: 9d5e16c859589f1a82bac6cfa7be998c8759841278e7848207607dad6cff7904

Bins SHA-256: a5dc928c93b99794d31eaf513bc4f82a953937488aece61d004ed0ee5faf91d1

The original fetchedAt values are 2026-10-23T15:46:12.587Z (protected) and 2026-10-23T15:46:12.545Z (bins). These are retrieval times, NOT survey/observation dates. No new retrieval time is invented.

## Parsing, identity, geometry

Reuse fatal CSV decoding, quoted-field parsing and validCoordinate directly from the existing village preparation domain: protected UTF-8, bins Big5, longitude 121.3–121.8 and latitude 24.8–25.3 inclusive. Source longitude/latitude values are WGS84 decimal degrees, verified against these bounds and the pinned Taipei regions; no projection, snapping or fabricated coordinates are applied to output. Geometry uses numeric [longitude, latitude]; original coordinate strings remain unchanged in properties. Point and collection bounding boxes are published.

Protected identity is trimmed official 樹木編號, preserving leading zeroes; original untrimmed source properties remain. Same-ID/same-position repeats would be duplicates; conflicting positions fail. Bins have no official ID: identity is JSON [trimmed 地址, numeric 經度, numeric 緯度]. Its SHA-256-based Feature id and _derivedId are explicitly marked derived, never official. Only exact identity repeats are removed. Nearby points or distinct addresses at the same position remain separate.

The polygon join matches prepare-village-game: meter-space containsPoint, indexed original bounding boxes, lowest region-array index on shared boundaries. Unmatched protected points remain published and _district is blank, not nearest-assigned. Bins _district uses the source official 行政區 (not address inference). All original columns remain unchanged; _name/_district/_search and identity annotations are derived display helpers.

## Scope and privacy review

These are already-published government records under 政府資料開放授權條款第1版 (https://data.gov.tw/license), not a new private or field-survey dataset.

Protected source (臺北市文化局): https://data.taipei/dataset/detail?id=d9d1140b-c2c3-405f-8dd1-7b87b00f6f53

Inspected source columns: 樹木編號, 樹種名稱, 樹種學名, 樹胸徑寬度公尺, 樹胸圍長度公尺, 地址, 緯度, 經度, 地理位置名稱, 管理單位, 英文名. 管理單位 and location categories include private management/private residences as well as institutions. They are existing public-register attributes, not consent or permission to enter property. No owner/contact enrichment, personal identifiers, phone numbers or inferred sensitive fields are added. Source addresses and management labels are retained exactly rather than inventing redacted or more precise locations. Chest diameter/circumference remain original 公尺 values, without conversion to centimeters.

This is a dated protection register, NOT proof of current legal protection, current condition, survival, public accessibility or an exhaustive tree census. Metadata coverage ends 2023-04-11; source file update is 2026-03-23, neither of which is a per-tree survey date.

Bins source (臺北市環境保護局): https://data.taipei/dataset/detail?id=a835f3ba-7f50-4b0d-91a6-9df128632d1c

Inspected source columns: 行政區, 地址, 經度, 緯度, 備註. The remarks are the official prohibition on household garbage. These are official pedestrian clean-bin records, NOT all garbage cans, household collection locations, current availability, capacity or a waste-service census. No names/contact information or personal attributes are introduced. Source file update/survey date is unknown, left null rather than inferred.

## Published files and verification

- public/data/village-record-layers.json: schemaVersion 1 and standard kind: point layer entries, source URL/agency/license, original-byte SHA, original retrieval time, source temporal limits, bbox and conservation audit.
- public/data/protected-trees.geojson: 3874 points, including 3 unmatched.
- public/data/clean-bins.geojson: 658 points.
- scripts/prepare-village-records.mjs: importable pure decoding, verification, identity, audit and preparation helpers; offline guarded entry point.
- tests/village-record-sources.test.mjs: byte hashes, pinned boundaries, manifest, full original-attribute equality, identities, geometry/bbox, audit conservation, invalid coordinates, duplicate/nearby fixtures, conflicting official IDs and fatal encoding.

No build, commit or deployment is performed by this task.

Published-inventory and geometry/identity/audit tests run from tracked artifacts on a clean checkout. The optional full original-byte round-trip audit additionally uses ignored source CSV caches; only that extra test is explicitly skipped when caches are absent. Publication preparation still fails closed if caches are missing or SHA mismatches.
