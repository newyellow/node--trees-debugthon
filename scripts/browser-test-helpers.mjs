// TREES_TEST_URL is a full explorer URL (also supports deployment prefixes).
export const explorerUrl = process.env.TREES_TEST_URL || process.env.PREVIEW_URL || process.env.BASE_URL || 'http://127.0.0.1:5173/explorer/index.html';
// Opt-in deterministic tiles; snapshots and all business assertions stay real.
export async function stubRemoteTiles(page) {
  if (process.env.TREES_STUB_TILES !== '1') return;
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname.includes('tile.openstreetmap.org') || url.hostname === 'wmts.nlsc.gov.tw') {
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e6ecdf"/></svg>' });
    }
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return route.abort();
    return route.continue();
  });
}
