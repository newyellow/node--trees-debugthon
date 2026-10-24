// The former popup/hover-radar contract is superseded by explicit three-level UX.
// Keep the established gate command compatible; source-loader conservation,
// cache/race, hash, same-coordinate and color contracts also run in npm test.
await import('./check-social-states-browser.mjs');
