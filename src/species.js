import { matches } from './explorer.js';
// Names are source labels, not a botanical taxonomy. Mixed labels remain one category.
export const UNKNOWN_SPECIES = '未提供／未辨識';
export function normalizeLabel(value) {
  return String(value ?? '').replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
}
const missing = new Set(['', '-', '--', '無', '不明', '未知', '未提供', '未辨識', '其他', 'unknown', 'null', 'n/a', 'na']);
export function speciesName(value) { const name = normalizeLabel(value); return missing.has(name.toLowerCase()) ? UNKNOWN_SPECIES : name; }
export function speciesColor(name) {
  if (name === UNKNOWN_SPECIES || name === '枯木') return '#767b80';
  const common = { '榕樹':'#19856b', '樟樹':'#d87526', '茄苳':'#7160ad', '黑板樹':'#2474aa', '楓香':'#bd4a70', '臺灣欒樹':'#8b7815', '大王椰子':'#1599a1', '小葉欖仁':'#9c541e', '菩提樹':'#c33e3e' };
  if (Object.hasOwn(common, name)) return common[name];
  let h = 2166136261; for (const c of name) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return 'hsl(' + ((h >>> 0) % 360) + ' 63% 39%)';
}
export function summarizeSpecies(features) {
  const counts = new Map(), variants = new Map();
  for (const f of features) {
    const raw = String(f.properties.TreeType ?? ''), name = speciesName(raw);
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (!variants.has(name)) variants.set(name, new Set()); variants.get(name).add(raw);
  }
  const total = features.length, missingCount = counts.get(UNKNOWN_SPECIES) ?? 0, statusCount = counts.get('枯木') ?? 0, unknown = missingCount + statusCount, known = total - unknown;
  const composition = [...counts].map(([name, count]) => ({ name, count, proportion: total ? count / total : 0, knownProportion: name !== UNKNOWN_SPECIES && name !== '枯木' && known ? count / known : null, variants: [...variants.get(name)] })).sort((a,b) => b.count-a.count || a.name.localeCompare(b.name,'zh-TW'));
  const identified = composition.filter(r => r.name !== UNKNOWN_SPECIES && r.name !== '枯木');
  const shannon = known ? -identified.reduce((s,r) => s + r.knownProportion * Math.log(r.knownProportion), 0) : null;
  const concentration = known ? identified.reduce((s,r) => s + r.knownProportion ** 2, 0) : null;
  return { total, known, unknown, missingCount, statusCount, richness: identified.length, shannon: shannon === 0 ? 0 : shannon, concentration, dominance: known ? identified[0].knownProportion : null, composition, top3: identified.slice(0,3) };
}
export function aggregateSpecies(regions, datasets, level, { district = '', query = '' } = {}) {
  const rows = new Map(), omitted = [], assignmentOmissions = [], considered = [], byLayer = {};
  const add = (key, name, feature, tree) => {
    if (!rows.has(key)) rows.set(key, { key, name, feature, features: [] });
    rows.get(key).features.push(tree);
  };
  if (level !== 'park') for (const f of level === 'district' ? regions.districts : regions.features) {
    if (!district || f.properties.district === district) rows.set(f.properties.id, { key: f.properties.id, name: f.properties.district === f.properties.name ? f.properties.name : f.properties.district + f.properties.name, feature: f, features: [] });
  }
  for (const { id, features } of datasets) {
    const membership = regions.membership[id];
    if (!membership || membership.length !== features.length) throw new Error('區里歸屬與樹木快照不一致；請更新分析資料。');
    features.forEach((tree, i) => {
      if (!matches(tree, '', query.toLowerCase())) return;
      const village = regions.features[membership[i]];
      const dist = level === 'park' ? normalizeLabel(tree.properties.Dist || tree.properties._district) : village?.properties.district;
      if (district && (dist || tree.properties._district) !== district) return;
      considered.push(tree); if (!village) assignmentOmissions.push(tree); byLayer[id] = (byLayer[id] ?? 0) + 1;
      if (level === 'park') {
        const park = normalizeLabel(tree.properties.ParkName);
        // Separate datasets and districts; no implied park polygon or name-based cross-source deduplication.
        const key = JSON.stringify([id, dist, park]);
        add(key, (dist || '未提供行政區') + ' · ' + (park || '未提供公園名稱') + ' · ' + (id === 'street-trees' ? '行道樹' : '公園樹木'), null, tree);
      } else if (!village) omitted.push(tree);
      else {
        const key = level === 'district' ? village.properties.district : village.properties.id;
        const row = rows.get(key); if (row) row.features.push(tree); else throw new Error('區里代碼無法對應');
      }
    });
  }
  return { rows: [...rows.values()].map(row => ({ ...row, ...summarizeSpecies(row.features) })), omitted: summarizeSpecies(omitted), assignmentOmissions: summarizeSpecies(assignmentOmissions), summary: summarizeSpecies(considered), byLayer };
}
