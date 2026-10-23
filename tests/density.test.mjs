import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDensityGrid, visibleDensityCells, toLngLat, toMeters, cellDensity, densityColor, DENSITY_STOPS } from '../src/density.js';

const feature = (x, y) => ({ geometry: { type: 'Point', coordinates: toLngLat([x, y]) } });
test('metric grid preserves all tree records and excludes non-tree datasets', () => {
  const features = [feature(303001, 2770001), feature(303249, 2770249), feature(303251, 2770251)];
  const grid = buildDensityGrid([{ id: 'street-trees', features }, { id: 'park-trees', features: [features[0]] }, { id: 'parks', features }], 250);
  assert.equal(grid.total, 4);
  assert.equal(grid.cells.size, 2);
  const cell = grid.cells.get(`${Math.floor(303001 / 250)},${Math.floor(2770001 / 250)}`);
  assert.equal(cell.count, 3);
  assert.deepEqual(cell.byLayer, { 'street-trees': 2, 'park-trees': 1 });
  assert.equal([...grid.cells.values()].reduce((sum, c) => sum + c.count, 0), 4);
});
test('viewport clipping preserves complete cell counts and produces empty cells within study bounds', () => {
  const grid = buildDensityGrid([{ id: 'street-trees', features: [feature(303001, 2770001), feature(303240, 2770240), feature(303600, 2770600)] }], 250);
  const sw = toLngLat([302990, 2769990]), ne = toLngLat([303750, 2770750]);
  const cells = visibleDensityCells(grid, [...sw, ...ne]);
  assert.equal(cells.length, 9);
  assert.equal(cells.filter(c => c.count === 0).length, 7);
  assert.equal(cells.reduce((sum, c) => sum + c.count, 0), 3);
  const smallSw = toLngLat([303001, 2770001]), smallNe = toLngLat([303100, 2770100]);
  const clipped = visibleDensityCells(grid, [...smallSw, ...smallNe]);
  assert.equal(clipped.find(c => c.count > 0).count, 2);
  assert.deepEqual(visibleDensityCells(grid, [122, 26, 123, 27]), []);
});
test('equal densities keep the same color across grid resolutions and filters', () => {
  assert.equal(cellDensity(20, 100), cellDensity(125, 250));
  assert.equal(cellDensity(20, 100), cellDensity(500, 500));
  for (const { value, color } of DENSITY_STOPS) assert.equal(densityColor(value), color);
  assert.equal(densityColor(1000), DENSITY_STOPS.at(-1).color);
  const empty = buildDensityGrid([], 100);
  assert.equal(empty.extent, null);
  assert.deepEqual(visibleDensityCells(empty, [121.4, 24.9, 121.7, 25.2]), []);
  assert.throws(() => buildDensityGrid([], 0), RangeError);
});
test('projected grid is anchored independently of the selected data extent', () => {
  const a = feature(303010, 2770010), b = feature(304010, 2771010);
  const full = buildDensityGrid([{ id: 'street-trees', features: [a, b] }], 100);
  const filtered = buildDensityGrid([{ id: 'street-trees', features: [b] }], 100);
  assert.deepEqual(full.cells.get('3040,27710'), filtered.cells.get('3040,27710'));
  const roundTrip = toMeters(toLngLat([303010, 2770010]));
  assert.ok(Math.abs(roundTrip[0] - 303010) < 0.001);
  assert.ok(Math.abs(roundTrip[1] - 2770010) < 0.001);
});
