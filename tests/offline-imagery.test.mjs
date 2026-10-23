import test from 'node:test';
import assert from 'node:assert/strict';
import { tileRange, imagePackageType } from '../scripts/offline-imagery.mjs';

test('offline plan uses north-to-south tile rows and includes boundary tiles', () => {
  const range = tileRange([-90, -66.5, 0, 0], 2);
  assert.deepEqual(range, { zoom: 2, minX: 1, maxX: 2, minY: 2, maxY: 2, tiles: 2 });
  const taipei = tileRange([121.45, 24.95, 121.67, 25.22], 19);
  assert.ok(taipei.minY < taipei.maxY && taipei.minX < taipei.maxX);
  assert.ok(taipei.tiles > 100000);
});

test('offline packages reject expired-link HTML and accept supported container signatures', () => {
  assert.throws(() => imagePackageType(Buffer.from('<html>Expired link</html>')), /錯誤頁/);
  assert.throws(() => imagePackageType(Buffer.alloc(0)), /錯誤頁/);
  assert.equal(imagePackageType(Buffer.from('SQLite format 3\0')), '.mbtiles');
  assert.equal(imagePackageType(Buffer.from('504b0304', 'hex')), '.zip');
  for (const header of ['49492a00', '4d4d002a', '49492b00', '4d4d002b']) {
    assert.equal(imagePackageType(Buffer.from(header, 'hex')), '.tif');
  }
});
