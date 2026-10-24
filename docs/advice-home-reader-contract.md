# Reader-facing home draft contract

## Authority and scope

Version: home-reader-v3.2. Canonical policy, input projection and review rubric: scripts/advice-home-reader-contract.mjs. Canonical native request assembly: prepareHomeReaderRequest in scripts/advice-home-draft-core.mjs. The historical HTTP runner is not the new workflow and must not be invoked for this task. No production prompt, original batch, DB, public shard, website API or deployment is changed.

prepareHomeReaderRequest({basePrompt,grounding,plantFacts,researchLedger}) returns systemPrompt, message, safe input, promptHash and inputHash without network/file/model operations. It preserves the original planting prefix and safety suffix, replaces only the home draft policy, then explicitly sets a separate native-only editorLedger envelope. It does not include candidate examples in the generation input. New generation/dispatch always needs its own authorization; constructing these packets is zero inference.

The former two-group production prompt and 912 cached outputs remain unchanged. This contract is draft authority, not a statement that the website has adopted a new generator. Native child results created before this contract was implemented are editorial candidate examples, not clean-generation validation of the committed prompt.

## Input schema

- grounding: village name/district, sourceSpecies name/count, recordCounts, blueprint planning context and ecology coverage. Counts remain evidence, not an answer opening. The builder projects only the safe fields; no raw tree IDs, individual coordinates, provider credentials or session history.
- researchLedger: reviewed records {id,url,title,checkedAt,reviewStatus:'reviewed'}. HTTPS, no embedded credential or token query. reviewed is an upstream human/source-review assertion, not automatic verification by this module.
- plantFacts: source-matched name and scientificName, identitySourceIds, uses (balcony/indoor), advantages and conditions arrays. Each evidence item is {id,text,sourceIds}; advantages are verified morphological/observation/design benefits, not unverified health or ecological claims. Cultivation/indoor suitability is separate from native identity. No fixed four-species list or forced per-village species differences.
- ingestionStatus: unknown / known-risk / reviewed-limited. Known-risk requires separately sourced safetyNotes. Unknown is never a safe/non-toxic assertion. Actual necessary care or known-risk instructions stay in the answer; generic missing-evidence narration does not.
- editorOnly.limitations: household/taxon/supplier/toxicology and source-coverage uncertainties. These go to editorInput and output editorLedger, not reader prose. They are not silently converted into positive safety/provenance claims.

plantFacts is an evidence-bounded pool, not an instruction to recommend every item. Advantages, identity and care all need traceability; a Flora API record or native flag alone is not verification. Use exact identity matching and bounded GET if new research is authorized; do not guess taxa.

## Output / review schema

Native draft output:

    {answer, plants:[{name}], vision:false,
     editorLedger:{status:'candidate-unapproved',
       recommendations:[{plantName,traitIds,streetTreeNames,planningConnection}],
       limitations:[]}}

Four paragraphs: actual local street trees → natural ecosystem green-network future proposal → home response; balcony; indoor; practical observation wrap-up. First paragraph has no statistical opening. Two to four candidates total, one or two per setting, exactly matching plants. Each recommendation must use supported plant advantages and a meaningful street-tree/green-network observation link, not merely replace synonyms or invent village climate. Same species across villages is allowed.

reviewHomeReaderDraft returns mechanicalPass, semanticReview:'required', userAccepted:false. Mechanical checks cover structure, numeric opening, obvious internal-disclaimer phrases, grouping, evidence IDs, actual street-tree labels and candidate-only status. They do NOT prove natural prose, taxonomic truth, every safety condition, semantic entailment or real-world suitability. The exported HOME_READER_RUBRIC.human gates those aspects before user acceptance. Approximate length (280–400 Han characters) and no-new-candidate ending also need editorial review.

## Candidate comparisons, not approved examples

Keep candidate answer examples and editor ledgers private outside public/dist/Git. Record actual model/method, original editorial input, canonical prompt/version/hash, source SHA and the distinction between editorial revision and clean generation. Never label examples golden/approved until the user explicitly accepts them. A better example does not demonstrate the future generator will reproduce it.

Comparison rubric:

1. Is the local starting point a real sourceSpecies label without numeric/data-dump opening?
2. Is the ecosystem connection explicitly a relevant future planning concept, not an unsupported habitat claim?
3. Does every recommended plant have a concrete sourced trait and a village-linked observational/design reason?
4. Are differences observational rather than fabricated environmental differences? Are repeated species allowed?
5. Are research attribution and evidence gaps in ledger only, while necessary conditions remain actionable?
6. Does the text avoid unsupported pet-safe, ingestion, nursery, health, air-purification or ecological-benefit claims?
7. Are four paragraphs, exact names, two settings, false vision and concise practical ending preserved?

## Verification

    node --test tests/advice-home-reader-contract.test.mjs tests/advice-home-draft.test.mjs
    node --check scripts/advice-home-reader-contract.mjs
    node --check scripts/advice-home-draft-core.mjs

These are offline contract/mock tests, not real generation or content acceptance. No unchanged frontend/full suite/build/viewport matrix is required for these draft-only modules. No HTTP model dispatch, retry, re-sampling, full-batch regeneration or public deployment belongs to this change.

## Single pilot gate (2026-10-24 22:49)

Newyellow accepted the three v3 texts as STYLE REFERENCES, not universal factual templates, not approval of every village or production deployment. Keep their exact private bytes and record approval message1563565000424161393 separately from candidate factual status. The Linquan pilot is purpose-selected for comparison, not random. Generator sees canonical rules/facts only, no Linquan old article and no other example (no-example fresh generation). An independently isolated reviewer receives draft, same facts, policy and rubric through prepareHomeReaderReviewRequest; one generation plus one review maximum, no automatic repair/retry. Save raw/final, both prompt/input hashes, actual model/run IDs and edits privately. Stop for user confirmation after final; no HTTP or production writes.

Future bulk DESIGN ONLY: at most six native children active across BOTH stages, deterministic village-ID shards, immutable source/version/hash, generator then different isolated reviewer then mechanical validation then atomic checkpoint. Single integrator owns all output writes; workers return data only. Per-stage one attempt by default; failure checkpoint remains failed and needs explicit bounded retry authorization, no loops. Resume only matching input/rule hashes, skip completed IDs. Whole-batch authorization is not granted by accepting a style sample.

### Missing local tree records

An empty sourceSpecies must not block all home advice or cause imported/fabricated village trees. The canonical HOME_READER_MISSING_SOURCE_POLICY requires a future/conditional green-network observation connection, no asserted existing local taxa, empty streetTreeNames, concrete sourced plant advantages and an explicit private planningConnection limitation. Batch task hashes pin this additive rule separately; original requests and completed content remain immutable. Existing reviewer missing-tree objections require a bounded re-review under the corrected rule, not fabricated evidence or silent success. No empty-data village is claimed to have passed a named-tree requirement.
