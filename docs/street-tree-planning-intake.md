# Supplied legacy PPT: full source audit

## Integrity and method
- Source bytes 582656; SHA-256 d33e9f0db0c9f0e3174e69f67618920e78dd545be512a42f396efd048288538d (verified).
- Parsed CFB FAT chains, complete PowerPoint Document record tree, Current User/UserEdit and persist directory. No macros executed; no app launch, install, UI-service change, repository edits, commits or deployment.
- Exactly **5 current slides**, 1 master and 3 Notes containers (two persisted notes, plus notes-master-related structure); the slide list is not 8 slides. Master instance=1 and notes instance=2 are explicitly separated in full-extraction.json. 1 UserEdit with previousEdit=0: no obsolete incremental edit chain found. Five physical Slide containers equal five current referenced slides; no orphan/obsolete Slide found.
- All record lengths fit parent bounds. Eleven TextCharsAtom records across document/master/slides/notes; full chained-stream parsing avoids sector-boundary losses. Exact source text bytes (hex), offsets and SHA-256 are retained per text record. CString metadata is retained separately, not conflated with displayed text.
- Two JPEG BLIPs extracted and visually read at original resolution. No unreadable embedded table remains. Original streams and images are preserved only in this intake artifact directory.

## Slide-level coverage (actual presentation order)
1. slideId 304, persistId 4, offset 58257: 臺北的生態特色; full editable text. Generic ecological geography, not a district species mapping.
2. slideId 307, persistId 5, offset 60484: image 1, 台北市生態環境分區圖. Geological/ecological map with area, watercourse, elevation and historical-expansion labels. Visual transcription in extraction/picture-1-visual-transcription.txt. No tree-species list.
3. slideId 308, persistId 6, offset 60969: 樹種建議; complete editable text at offset 61221. **29 names, three groups**: 大喬木10, 中喬木10, 小喬木9. Source intervals retained exactly: 樹高10 公尺以上者 / 樹高6-10 公尺之間 / 樹高 6 公尺以下. Do not impose mutually exclusive numeric boundaries. Source says maintenance items are in a table (請見表), but no lifecycle-maintenance table appears among these five slides; only the district table below is actually included.
4. slideId 309, persistId 7, offset 62312: image 2, **表 18. 臺北市各行政區前 5 大現有行道樹樹種**. Fully legible: **12 districts × 5 quantity ranks = 60 source rows**, 17 distinct literal names. This IS actual district common-species information; it was missed by raw-text scans because it is embedded JPEG. Table gives ranking only, no counts, percentages, census date or underlying report attribution visible.
5. slideId 310, persistId 8, offset 62755: editable text at offset 63181, 20 names attributed in source to **邱清安：臺灣都市林樹種可用名錄，2018**. Citation and names preserved; cited original not independently fetched/verified. This is Taiwan urban-forest suitability, not district occurrence.

## Source title, attribution and date: actual evidence only
- No overall cover/title/author/date slide. SummaryInformation Title=投影片 1 (generic metadata, not a descriptive publication title); Author=CM; LastSavedBy=Justin; Application=Microsoft Office PowerPoint; revision=22. DocumentSummaryInformation Company=NTU. These do NOT establish Justin as original author, CM's identity, NTU publication, or a 2018 publication date for this PPT.
- Metadata Created=2007-10-17T10:09:25.343Z; LastSaved=2026-10-24T09:11:17.291Z. Created may be inherited/template history, not date of the current five-slide content. 2018 belongs to cited list only. Total editing time is a duration (01:16:50.738), not a 1601 publication date.
- Table 18 has no visible source/date credit. Treat source as Justin-supplied PPT, date of underlying district inventory unknown; do not describe as a current 2026 inventory.

## Integration deliverables and policy
- district-top5-source.json and .csv: 60 ranked rows, exact district/name labels, slideId/image hash provenance.
- height-recommendations-source.json: 29 recommendations, verbatim group/height wording, source text hash.
- cited-2018-top20-source.json: 20 literal source names with citation and limitation.
- extraction/current-slides.json and extraction/slides.txt: correct five-slide ordering plus source offsets/hashes and embedded image links.
- extraction/full-extraction.json: full record tree, persist map, original text hex/hashes, master/notes distinction.
- extract_ppt.py and audit_ppt.py: reproducible stdlib extraction/audit. JSON property metadata and source binary streams are in extraction/.
- Do not silently unify 楝樹 with 苦楝, 流蘇 with 流蘇樹, or 紫薇 with 小花紫薇/大花紫薇. Literal source labels are not independently verified taxonomy.
- Preserve raw recommendations including 水黃皮 and all district observations, including excluded species. The later eight-species project exclusion policy supersedes eligibility/recommendation presentation, not historical source evidence. No new policy invented or applied here; corrections.json was not modified.
- Ecological map regions (e.g. 南港信義區) must not be used to infer administrative-district species rows; district data comes exclusively from slide 4's explicit table.

## Verification / limitations
Validated 5 current slides, 2 pictures, 29 height rows, 60 district-rank rows / 12 districts, 20 cited names; no record-bound errors. Both image BLIPs mapped to current slides using OfficeArt pib property 0x4104 (slide 2→picture 1, slide 4→picture 2). Visual table transcription checked against the original image. No rendered whole-presentation screenshot was required to read these two standalone source images; exact shape/slide geometry remains in binary streams. Underlying district survey date/report and cited 2018 original remain unverified, not extraction blockers.


## Committed data-only projection

Canonical structured snapshot: public/data/street-tree-planning-knowledge.json. Original PPT, images and binary streams stay only in local intake artifacts. Preserve all 29 height entries, 60 district ranks and 20 cited names including excluded source records; only recommendation reference projections filter project-excluded plants. District ranking is not present village inventory. Latest snapshot is committed for frozen generation; no public website or service deployment.
