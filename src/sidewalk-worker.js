import { treeIndex, prepareSidewalk, scoreSidewalk } from './analysis.js';

let sidewalks = [], prepared = new Map(), indexKey = '', index;
const trees = new Map(), resultSets = new Map();
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'sidewalks') { sidewalks = data.features; prepared.clear(); resultSets.clear(); return; }
    if (data.type === 'trees') { trees.set(data.id, data.coordinates); indexKey = ''; resultSets.clear(); return; }
    if (data.type !== 'analyze') return;
    const key = JSON.stringify(data.ids);
    if (indexKey !== key) { index = treeIndex(data.ids.map(id => ({ id, coordinates: trees.get(id) ?? [] }))); indexKey = key; }
    const config = JSON.stringify([key, data.options]);
    const results = resultSets.get(config) ?? new Map();
    resultSets.delete(config); resultSets.set(config, results);
    while (resultSets.size > 4) resultSets.delete(resultSets.keys().next().value);
    const rows = data.indices.map(i => {
      if (!results.has(i)) {
        if (!prepared.has(i)) prepared.set(i, prepareSidewalk(sidewalks[i]));
        results.set(i, scoreSidewalk(prepared.get(i), index, data.options));
      }
      return { index: i, ...results.get(i) };
    });
    self.postMessage({ token: data.token, rows });
  } catch (error) { self.postMessage({ token: data.token, error: error.message }); }
};
