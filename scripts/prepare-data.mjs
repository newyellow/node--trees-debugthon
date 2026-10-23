import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { districtName, validCoordinate, finiteNumber, toWgs84, convertGeometry, geometryBounds } from './data-utils.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const definitions = [
  { id: 'street-trees', title: '行道樹', color: '#327853', kind: 'point', source: 'https://data.gov.tw/dataset/128274', url: 'https://tppkl.blob.core.windows.net/blobfs/TaipeiTree.json', agency: '工務局公園處', description: '道路上的樹木位置、樹種與量測紀錄。' },
  { id: 'park-trees', title: '公園樹木', color: '#82a744', kind: 'point', source: 'https://data.gov.tw/dataset/128274', url: 'https://tppkl.blob.core.windows.net/blobfs/TaipeiParkTree.json', agency: '工務局公園處', description: '公園內樹木的逐棵調查紀錄。' },
  { id: 'tree-pits', title: '人行道樹穴／花圃', color: '#c7833b', kind: 'polygon', source: 'https://data.gov.tw/dataset/134908', url: 'https://data.taipei/api/dataset/693705fa-4604-4207-bd50-8a9ce9fcfbc6/resource/3e2b359b-8dae-46e4-a747-5912d8743d0e/download', agency: '工務局新工處', description: '樹穴與花圃的實際範圍；不代表空穴或可直接種植。' },
  { id: 'sidewalks', title: '人行道範圍', color: '#687dc1', kind: 'polygon', source: 'https://data.taipei/dataset/detail?id=715d3a83-8445-4496-b6bf-b0900538b7e7', url: 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=b11d6142-1d71-41d5-a843-7b7cfcea61ef', agency: '工務局新工處', description: '人行道面域、路段、寬度與淨寬資料。' },
  { id: 'parks', title: '公園、綠地與廣場', color: '#229b9a', kind: 'point', source: 'https://data.taipei/dataset/detail?id=ea732fb5-4bec-4be7-93f2-8ab91e74a6c6', url: 'https://parks.gov.taipei/parks/api/', agency: '工務局公園處', description: '公園基本資料的位置點，並非公園邊界。' },
];
await mkdir(path.join(root, 'public/data'), { recursive: true });
await mkdir(path.join(root, 'data/raw'), { recursive: true });
const staging = path.join(root, 'data/staging');
await mkdir(staging, { recursive: true });
const refresh = !process.argv.includes('--cached');
const metadata = [];
try {
  for (const definition of definitions) {
    const rawFile = path.join(root, `data/raw/${definition.id}.json`);
    if (refresh) {
      const temporary = `${rawFile}.download`;
      execFileSync('curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '2', '--max-time', '180', definition.url, '-o', temporary], { stdio: 'inherit' });
      JSON.parse((await readFile(temporary, 'utf8')).replace(/^\uFEFF/, ''));
      await rename(temporary, rawFile);
    }
    const raw = JSON.parse((await readFile(rawFile, 'utf8')).replace(/^\uFEFF/, ''));
    const rows = Array.isArray(raw) ? raw : raw.features;
    if (!Array.isArray(rows) || !rows.length) throw new Error(`Unexpected or empty source: ${definition.id}`);
    const features = [], byDistrict = {}, bounds = [Infinity, Infinity, -Infinity, -Infinity];
    let missingDistrict = 0, latestRecordUpdate = '';
    for (const row of rows) {
      const properties = row.properties ?? row;
      let geometry;
      if (row.geometry) geometry = convertGeometry(row.geometry);
      else {
        const coordinate = definition.id === 'parks'
          ? [finiteNumber(row.pm_Longitude), finiteNumber(row.pm_Latitude)]
          : toWgs84(row.TWD97X, row.TWD97Y);
        if (validCoordinate(coordinate)) geometry = { type: 'Point', coordinates: coordinate };
      }
      if (!geometry) continue;
      const district = districtName(properties.Dist ?? properties.Town_N ?? properties.pm_regions);
      const bbox = geometryBounds(geometry);
      const name = properties.TreeType ?? properties.pm_name ?? properties.NAME_Road ?? properties.Name ?? definition.title;
      features.push({ type: 'Feature', geometry, bbox, properties: { ...properties, _district: district, _name: name } });
      byDistrict[district || '未提供'] = (byDistrict[district || '未提供'] ?? 0) + 1;
      if (!district) missingDistrict++;
      if (properties.UpdDate > latestRecordUpdate) latestRecordUpdate = properties.UpdDate;
      bounds[0] = Math.min(bounds[0], bbox[0]); bounds[1] = Math.min(bounds[1], bbox[1]);
      bounds[2] = Math.max(bounds[2], bbox[2]); bounds[3] = Math.max(bounds[3], bbox[3]);
    }
    if (!features.length) throw new Error(`No valid geometries: ${definition.id}`);
    const file = `${definition.id}.geojson`;
    await writeFile(path.join(staging, file), JSON.stringify({ type: 'FeatureCollection', features }));
    metadata.push({ ...definition, file, total: rows.length, valid: features.length, excluded: rows.length - features.length, missingDistrict, byDistrict, bounds, latestRecordUpdate: latestRecordUpdate || null, originalCrs: definition.id === 'parks' ? 'WGS84' : 'TWD97 / TM2 zone 121 (EPSG:3826)' });
    console.log(`${definition.title}: ${features.length.toLocaleString()} mapped / ${rows.length.toLocaleString()} records`);
  }
  await writeFile(path.join(staging, 'manifest.json'), JSON.stringify({ fetchedAt: new Date().toISOString(), simulated: false, layers: metadata }, null, 2));
  for (const file of [...metadata.map(d => d.file), 'manifest.json']) await rename(path.join(staging, file), path.join(root, 'public/data', file));
} finally { await rm(staging, { recursive: true, force: true }); }
