# Mountain ecological knowledge source

## Data contract

Canonical structured source: public/data/mountain-ecology-knowledge.json. Flat occurrence/context export: public/data/mountain-ecology-records.csv. These extend the existing static JSON knowledge store and server-selected AI grounding; no SQL service, vector database or retrieval service is added. There is no new catalogue UI.

Source: user-supplied -110.03.23.docx, received 2026-10-24. SHA256 ede609af5f36f10ce5bb31c350a7fdd5abaafa5a7cf91f517e11c81c798266b7. The title is a descriptive catalogue label, not a title claimed to appear in the report. Author is unknown: earlier proposal attribution to 洪睿晉 does not establish authorship of this DOCX. The supplied raw document remains local and is not publicly redistributed. DOCX metadata modification date 2021-03-23 is not a survey date.

There are 91 main-body paragraphs and no tables. Stable locators p001–p091 count all main-body paragraphs, including empty paragraphs; they are not page numbers. Each group/claim preserves its paragraph hash and an exact short excerpt. Group excerpts span the named plant list rather than blindly taking the paragraph prefix. The audit script independently opens the original ZIP/XML and checks byte hash, paragraph hashes, every listed name and every excerpt.

## Inventory and evidence lanes

- 40 groups, 365 plant–context records, 204 distinct raw source labels. This is NOT 204 taxonomically verified species and is NOT the complete 249-taxon inventory mentioned by the report.
- 23 source-attributed environmental/method/design/statistical claims; three explicit 茄苳–bird/insect relationships, unverified.
- 2020-06 chapter summary and 2021-02 second-survey context; 114 February phenology entries across fruiting, spores, flowering and new leaves. No yearly calendar or present population trend is inferred.
- p085 separates four site-surroundings new-leaf observations from four stable-growth names in unspecified hillside forests; the month is explicitly inferred from section context, not stated in that paragraph.
- Field observations, source-native/endemic/naturalized classifications and source-design proposals remain separate. Presence never implies recommendation, current abundance, survival or site suitability.
- p050 lists 14 cultivated taxa but names only six distinct examples (朱蕉 appears twice). Named examples are not a complete14-name list.

## Four-region connection

The previous blueprint remains unchanged. The crosswalk has20 region–plant pairs with9 exact-label hits. A hit means only that the same label appears somewhere in the document, NOT that it was surveyed in that blueprint region. No synonym merging or species identification occurs.

- 南港: directly named mountain context; not every village in 南港／信義／文山 surveyed.
- 內湖: interpretive connection to 五指山南緣; neither equivalent boundaries nor all 內湖／松山 surveyed.
- 陽明山: not covered; 大屯／七星山 occur only as geographical context.
- 淡水河濱: not covered; 基隆河／pond context cannot replace a 淡水河濱 flora survey.

No coordinates or georeferenced survey polygons were supplied. Administrative blueprint association does not imply environmental homogeneity. Every projected context explicitly sets selectedVillageSurveyed=false.

## Conflicts retained

The first total is222 at p047 and221 at p063. The stated native165+cultivated14+naturalized44 sum to223, without an explanation of category overlap. Percentages6.66/8.11/74.66 do not have consistent explicit denominators. They are stored as source claims, never silently corrected into authoritative figures. Preserve raw 紅楠／豬腳楠／紅楠（豬腳楠）, 茄冬／茄苳, 楝／苦楝 and 馬櫻丹／馬纓丹. 烏桕 appears as naturalized and as 原生烏桕; no definite native status is assigned. The lowland-old-tree ranking is recorded as an unsupported source claim, not a system ranking. Cultural food-use prose is not ingestion guidance. Diversity/ventilation design comments are not guarantees against disease or permission to change spacing/remove plants.

## AI integration

server/plant-advice-ecology.mjs pins exact JSON bytes with ECOLOGY_SHA256, verifies conservation/references and projects only source metadata, selected regional habitat groups, at most20 deduplicated design candidates, attributed design reasons, relevant limitations and conflicts. Original file paths, uploader identity, Discord link, raw source body, source record arrays and individual tree coordinates/IDs are not sent to inference. The public compact dataset contains provenance; the raw DOCX is not served.

Named source naturalized/invasive labels and ambiguous aliases are excluded from automatic candidate references. This filter is not an independent botanical classification. Source observations remain stored, including unwanted plants, but are not recommended because of occurrence. Design candidates retain their actual 市民大道七八段 corridor area and source-design-proposal status; they are not relabelled as the selected village's flora. No habitat/plant claims are projected for uncovered regions. Home mode must not treat the mountain list as a balcony/indoor list. Existing short friendly answer contract, streaming, resource bounds, source snapshots, scores and proposal are unchanged.

Prompt constraints plus filtered grounding are defense in depth, not a guarantee of factual model output. General follow-up still requires site light, root space, soil/drainage, wind, utilities, traffic, maintenance and professional review. No planting/removal authority is granted.

## Validation and release

Run the local source audit with the original attachment path:

    python3 scripts/audit-mountain-ecology.py /absolute/path/to/source.docx
    node --test tests/mountain-ecology.test.mjs tests/advice-tone-prompt.test.mjs
    node --test --test-name-pattern='real public grounding|tampered game' tests/plant-advice-server.test.mjs

The inference fixture is mock-only; no credential is read and no model usage occurs. Required build runs once on the committed snapshot. No unrelated full test suite, viewport matrix or live model sample is required for this data integration.

Serialized integrator must preserve current main, deploy new JSON/CSV before reloading ONLY the advice app, verify startup + public health and exact versioned JSON/CSV bytes, and verify deployed-source projection against production dist. No Gateway/agent configuration, credential, LaunchAgent, static service, hostname or tunnel changes are needed. No frontend entry changes are intended. Changing catalogue bytes requires updating ECOLOGY_SHA256; missing/tampered data fails closed. Back up previous backend source and dist before incremental deployment. Keep raw DOCX outside public/git.

