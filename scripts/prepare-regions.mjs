import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as shapefile from 'shapefile';
import clipping from 'polygon-clipping';
import RBush from 'rbush';
import { toMeters, toLngLat } from '../src/density.js';
import { mapGeometry, containsPoint, geometryArea, metricBounds } from '../src/spatial.js';

const root = new URL('../', import.meta.url);
const rawDir = new URL('data/raw/villages/', root);
await mkdir(rawDir, { recursive: true });
const zip = new URL('data/raw/villages.zip', root);
const download = 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=145e30da-58f3-45db-a125-8adc3fde2620';
if (!process.argv.includes('--cached')) execFileSync('curl', ['-fsSL', '--retry', '2', '--max-time', '120', download, '-o', fileURLToPath(zip)], { stdio: 'inherit' });
execFileSync('unzip', ['-o', fileURLToPath(zip), '-d', fileURLToPath(rawDir)], { stdio: 'ignore' });
const files = await readdir(rawDir);
const shp = files.find(f => f.endsWith('.shp'));
const encoding = (await readFile(new URL(shp.replace('.shp', '.cpg'), rawDir), 'utf8')).trim();
const raw = await shapefile.read(fileURLToPath(new URL(shp, rawDir)), undefined, { encoding });
// Source shared edges contain floating-point noise; snap to 1 cm before dissolving.
for (const f of raw.features) f.geometry = mapGeometry(f.geometry, ([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
const villages = raw.features.map(f => {
  const p = f.properties, geometry = mapGeometry(f.geometry, toLngLat);
  return { type: 'Feature', geometry, bbox: metricBounds(geometry), properties: { id: String(p.NPTVID), name: p.VNAME, district: p.TNAME, area: geometryArea(f.geometry) } };
}).sort((a, b) => a.properties.id.localeCompare(b.properties.id));
if (villages.length !== 456 || villages.some(v => !v.properties.district.endsWith('區') || !v.properties.name.endsWith('里'))) throw new Error('Unexpected boundary count or encoding');
const names = [...new Set(villages.map(v => v.properties.district))];
if (names.length !== 12) throw new Error('Expected 12 districts');
const districts = names.map(name => {
  const group = raw.features.filter(f => f.properties.TNAME === name);
  const metricGeometry = { type: 'MultiPolygon', coordinates: clipping.union(...group.map(f => f.geometry.coordinates)) };
  const geometry = mapGeometry(metricGeometry, toLngLat);
  return { type: 'Feature', geometry, bbox: metricBounds(geometry), properties: { id: name, name, district: name, area: geometryArea(metricGeometry) } };
});
const index = new RBush();
index.load(villages.map((v, i) => ({ minX: v.bbox[0], minY: v.bbox[1], maxX: v.bbox[2], maxY: v.bbox[3], i, geometry: mapGeometry(v.geometry, toMeters) })));
const manifest = JSON.parse(await readFile(new URL('public/data/manifest.json', root)));
const membership = {};
const unmatched = {};
for (const layer of ['street-trees', 'park-trees']) {
  const data = JSON.parse(await readFile(new URL(`public/data/${layer}.geojson`, root)));
  let missing = 0;
  membership[layer] = data.features.map(f => {
    const [lng, lat] = f.geometry.coordinates, point = toMeters(f.geometry.coordinates);
    const matches = index.search({ minX: lng, minY: lat, maxX: lng, maxY: lat }).filter(item => containsPoint(point, item.geometry)).sort((a, b) => a.i - b.i);
    if (!matches.length) missing++;
    return matches[0]?.i ?? -1;
  });
  unmatched[layer] = missing;
  console.log(`${layer}: ${data.features.length - missing} assigned, ${missing} outside boundaries (retained as unmatched)`);
}
const result = { type: 'FeatureCollection', features: villages, districts, membership, unmatched, treeSnapshot: manifest.fetchedAt, fetchedAt: new Date().toISOString(), source: 'https://data.taipei/dataset/detail?id=6b17b31d-4e16-495e-95b1-9fd1f47c80d8', download, method: 'Official village boundaries, district boundaries dissolved from the same source. Spatial point-in-polygon, boundary ties assigned once by sorted village ID.' };
const output = new URL('public/data/regions.json', root);
await writeFile(`${fileURLToPath(output)}.tmp`, JSON.stringify(result));
await rename(`${fileURLToPath(output)}.tmp`, fileURLToPath(output));
console.log(`${villages.length} villages, ${districts.length} districts; area ${districts.reduce((a, d) => a + d.properties.area, 0) / 1e6} km²`);
