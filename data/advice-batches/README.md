# Frozen village advice generation artifact

Version:4577aeaa30f65e6052df3bc5d9aef737f3d8f7cc9f5eeb82df5982800c70efab
Frozen inference source:bb7d46631d9628a81ab99111e0123768eeba8274
Generated2026-10-24; terminal review19:43 Asia/Taipei.

-456 villages ×2 modes =912 unique jobs.
-910 validated successes:456 planting,454 home.
-2 home errors; no pending/inflight and no automatic retry of uncertain errors.
-6300100008/home:uncertain-interrupted,1 attempt.
-6300100021/home:uncertain-or-invalid,1 attempt.
-912 total attempts; every job has exactly1 attempt. This is NOT912 successful recommendations.

The compact JSON is semantically identical to the private operator tool's final safeExport projection. It includes all job statuses, validated answer text, exact candidate names/scientificName when supplied, public source citations, region IDs, optional tour kind, input/prompt/data/file hashes and original operator-verified model provenance. It excludes images, binary files, Flora descriptions, raw provider responses, credentials and full grounding bodies. Source/candidate identity must remain exact; do not replace missing records with a successful record from another village.

SQLite remains private outside this repository, with verified backup and integrity/FK/grounding/metadata checks. Model identity metadata reports configured identity, not independent provider attestation. The batch was initially sequential and later resumed with a single owner and up to3 bounded calls; original frozen prompts/knowledge/version were preserved.

This directory is outside public/ and dist/: it is an audited future-consumption artifact only. The site still uses its existing live advice flow; this commit does not integrate cached reading, expose the database, publish a new data route, or change services/configuration. Filling the two errors requires explicit authorization to make potentially duplicate-billed requests. Human editorial review is still needed for generated language and botanical suitability; structural validation is not factual certification.
