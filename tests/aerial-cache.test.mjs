import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAerialCache, parseTilePath } from '../scripts/aerial-cache.mjs';

const tile = '/__aerial-cache/PHOTO2025/19/224455/439123';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2J1sAAAAASUVORK5CYII=', 'base64');

test('aerial cache rejects arbitrary URLs, unsupported years and out-of-range coordinates', () => {
  assert.deepEqual(parseTilePath(tile), { layer: 'PHOTO2025', z: 19, y: 224455, x: 439123 });
  for (const url of ['/__aerial-cache/PHOTO2026/19/1/1', '/__aerial-cache/PHOTO2025/20/1/1',
    '/__aerial-cache/PHOTO2025/1/2/1', '/__aerial-cache/PHOTO2025/19/../1', 'https://example.com/']) assert.equal(parseTilePath(url), null);
});

test('concurrent tile requests share one download, and disk cache survives server restart offline', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'trees-aerial-cache-'));
  let calls = 0;
  try {
    const cache = createAerialCache({ directory, download: async url => {
      calls++;
      assert.equal(url, 'https://wmts.nlsc.gov.tw/wmts/PHOTO2025/default/GoogleMapsCompatible/19/224455/439123');
      return png;
    } });
    const results = await Promise.all([cache.get(tile), cache.get(tile)]);
    assert.equal(calls, 1);
    assert.ok(results.every(result => result.bytes.equals(png)));
    assert.equal((await cache.get(tile)).cache, 'HIT');
    const offline = createAerialCache({ directory, offline: true, download: () => { throw new Error('Network must not run'); } });
    assert.equal((await offline.get(tile)).cache, 'HIT');
    await assert.rejects(offline.get(tile.replace('439123', '439124')), /尚未下載/);
    const metadata = JSON.parse(await readFile(path.join(directory, 'PHOTO2025/19/224455/439123.png.json'), 'utf8'));
    assert.equal(metadata.crs, 'EPSG:3857');
    assert.equal(metadata.captureDate, null);
    assert.equal(metadata.sha256.length, 64);
    assert.equal(calls, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('error pages and failed transfers never poison the persistent tile cache', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'trees-aerial-cache-'));
  let calls = 0;
  try {
    const cache = createAerialCache({ directory, download: async () => ++calls === 1 ? Buffer.from('<html>Error</html>') : png });
    await assert.rejects(cache.get(tile), /不是 PNG 或 JPEG/);
    assert.equal((await cache.get(tile)).cache, 'MISS');
    assert.equal(calls, 2);
    assert.equal((await cache.get(tile)).cache, 'HIT');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
