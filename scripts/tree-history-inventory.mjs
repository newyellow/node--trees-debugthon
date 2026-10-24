import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const labels = new Map(), inputs = [];
for (const id of ['street-trees', 'park-trees']) {
  const path = 'public/data/' + id + '.geojson';
  const bytes = await readFile(new URL(path, root));
  const data = JSON.parse(bytes);
  inputs.push({ path, sha256: createHash('sha256').update(bytes).digest('hex'), records: data.features.length });
  for (const feature of data.features) {
    const p = feature.properties;
    const label = String(p.TreeType ?? p._name ?? '').trim();
    if (!labels.has(label)) labels.set(label, { label, count: 0, byDataset: {}, districts: {} });
    const entry = labels.get(label); entry.count++;
    entry.byDataset[id] = (entry.byDataset[id] || 0) + 1;
    const district = p._district || '未提供';
    entry.districts[district] = (entry.districts[district] || 0) + 1;
  }
}
const entries = [...labels.values()].sort((a,b) => b.count-a.count || a.label.localeCompare(b.label, 'zh-Hant')).map((entry, i) => ({
  id: 'species-' + String(i+1).padStart(3, '0'), ...entry,
  nameStatus: !entry.label || entry.label === '枯木' || entry.label.includes('?') ? 'needs-name-review' : 'source-label',
  searchStatus: 'pending',
}));
const output = { schemaVersion: 1, createdAt: '2026-10-24', scope: 'Current mapped street and park tree snapshots; exact trimmed source labels, not taxonomic species. No synonym merging or source refresh.', inputs, totalLabels: entries.length, totalRecords: entries.reduce((n,e)=>n+e.count,0), entries };
const path = new URL('docs/research/species-inventory.json', root);
const content = JSON.stringify(output, null, 2) + String.fromCharCode(10);
if (process.argv.includes('--check')) {
  if (await readFile(path, 'utf8') !== content) throw new Error('Inventory differs from pinned current snapshot; investigate before regenerating stable IDs');
} else await writeFile(path, content);
console.log('Inventory ' + entries.length + ' labels / ' + output.totalRecords + ' records; ' + (process.argv.includes('--check') ? 'matches' : 'generated'));
