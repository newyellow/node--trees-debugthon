import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { districtName, toWgs84, validCoordinate, convertGeometry, districts } from '../scripts/data-utils.mjs';
import { matches, gridGroups, unionBounds } from '../src/explorer.js';

test('TWD97 control point transforms near Taipei 101 without swapping axes', () => {
  const result = toWgs84(306962, 2769658);
  assert.ok(Math.abs(result[0] - 121.5645) < 0.001);
  assert.ok(Math.abs(result[1] - 25.0339) < 0.001);
  for (const invalid of [[null, 2769658], ['', 2769658], ['bad', 3], [0, 0]]) assert.equal(toWgs84(...invalid), null);
  assert.equal(validCoordinate([null, 25]), false);
});
test('all Taipei district codes including three-digit suffixes normalize', () => {
  districts.forEach((name, index) => assert.equal(districtName(`63000${String((index + 1) * 10).padStart(3, '0')}`), name));
  assert.equal(districtName('臺北市內湖區'), '內湖區');
});
test('polygon rings transform recursively and invalid coordinates reject the geometry', () => {
  const geometry = convertGeometry({ type: 'MultiPolygon', coordinates: [[[[306962,2769658],[306963,2769658],[306962,2769659],[306962,2769658]]]] });
  assert.equal(geometry.type, 'MultiPolygon');
  assert.deepEqual(geometry.coordinates[0][0][0], geometry.coordinates[0][0][3]);
  assert.equal(convertGeometry({ type: 'Polygon', coordinates: [[[null, 2769658]]] }), null);
});
test('grid aggregation preserves every record, with combined district and keyword filtering', () => {
  const features = Array.from({ length: 100 }, (_, i) => ({ bbox: [121.5+i/100000,25,121.5+i/100000,25], properties: { _district: i < 60 ? '大安區' : '中正區', TreeType: i % 2 ? '榕樹' : '樟樹' } }));
  const filtered = features.filter(f => matches(f, '大安區', '榕樹'));
  assert.equal(filtered.length, 30);
  const groups = gridGroups(filtered, ([lat,lng]) => ({ x: lng * 100, y: lat * 100 }), 56);
  assert.equal(groups.reduce((n, g) => n + g.features.length, 0), 30);
  assert.equal(unionBounds(features)[2], features.at(-1).bbox[2]);
  assert.equal(unionBounds([]), null);
});
test('prepared snapshot reconciles counts, districts and valid WGS84 geometries', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/data/manifest.json', import.meta.url)));
  assert.equal(manifest.simulated, false);
  for (const layer of manifest.layers) {
    const data = JSON.parse(await readFile(new URL(`../public/data/${layer.file}`, import.meta.url)));
    assert.equal(data.features.length, layer.valid);
    assert.equal(layer.valid + layer.excluded, layer.total);
    assert.equal(Object.values(layer.byDistrict).reduce((a,b) => a+b, 0), layer.valid);
    assert.ok(Object.keys(layer.byDistrict).every(name => districts.includes(name)));
    for (const feature of data.features) {
      assert.ok(validCoordinate(feature.bbox.slice(0,2)));
      assert.ok(validCoordinate(feature.bbox.slice(2,4)));
    }
  }
});
