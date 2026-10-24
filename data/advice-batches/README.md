# Frozen village advice generation artifact

Version:4577aeaa30f65e6052df3bc5d9aef737f3d8f7cc9f5eeb82df5982800c70efab
Frozen inference source:bb7d46631d9628a81ab99111e0123768eeba8274
Generated2026-10-24; terminal review19:43 Asia/Taipei.

-456 villages ×2 modes =912 unique jobs.
-912 validated successes:456 planting,456 home.
-0 errors/pending/inflight after two explicitly authorized one-shot regenerations.
-6300100008/home:success on authorized attempt2; original uncertain-interrupted attempt retained.
-6300100021/home:success on authorized attempt2; original uncertain-or-invalid attempt retained.
-914 total attempts;910 jobs have1 attempt and the two authorized home jobs have2. Original910 results unchanged.

The compact JSON is semantically identical to the private operator tool's final safeExport projection. It includes all job statuses, validated answer text, exact candidate names/scientificName when supplied, public source citations, region IDs, optional tour kind, input/prompt/data/file hashes and original operator-verified model provenance. It excludes images, binary files, Flora descriptions, raw provider responses, credentials and full grounding bodies. Source/candidate identity must remain exact; do not replace missing records with a successful record from another village.

SQLite remains private outside this repository, with verified backup and integrity/FK/grounding/metadata checks. Model identity metadata reports configured identity, not independent provider attestation. The batch was initially sequential and later resumed with a single owner and up to3 bounded calls; original frozen prompts/knowledge/version were preserved.

This directory is outside public/ and dist/: it is an audited future-consumption artifact only. A separate sanitized projection under public/data/precomputed-advice supplies cached-only website reading. The private SQLite database is never published. No further inference is authorized by loading or retrying cached content. Human editorial review is still needed for generated language and botanical suitability; structural validation is not factual certification.
