# Production Google Analytics

Authorized by Newyellow game message1563531934435381380 at2026-10-24 20:37. Public GA4 measurement ID: G-DVFB0184YR (not a credential).

The single scripts/google-analytics.mjs Vite build plugin inserts the supplied standard async gtag loader and js/config queue at the start of head for all six configured production HTML entries: home, stories, story research, explorer, workspace02 and workspace03. It rejects an entry already containing gtag/Google Analytics instead of injecting twice. The generated homepage may still be rebuilt from index.template.html; analytics is added afterward by Vite, not to the generated source. Development is intentionally excluded to avoid local-work traffic; built preview and deployed pages include the standard tag.

Inspection found no existing analytics, consent manager or consent commands in the current entry/source files, and no live root Content-Security-Policy header. No consent behavior was removed or overridden; dataLayer is preserved. No CSP, server, Gateway, route or credential configuration changed. No custom events, user ID, application PII, extra advertising options or custom dimensions were added. Standard GA behavior remains subject to the owner's Google-side property settings. This integration is not a legal/privacy compliance assessment.

Verification is intentionally non-collecting: scoped unit evaluates only the supplied initializer in an isolated VM, checks the two commands and preservation of an existing dataLayer item, and duplicate rejection. Built-output assertions verify one async loader and one config per each of six entries. Public deployment is checked via HTTP HTML comparison, which does not execute analytics. No real browser collect request was sent as a test and no GA account/report access was available; neither Google network delivery nor reporting receipt is claimed.

Checks: node --test tests/google-analytics.test.mjs; TEST_DIST=<built-directory> node --test tests/google-analytics.test.mjs. Required build649ms. UI release4190be1 remains unchanged beneath this analytics-only release.
