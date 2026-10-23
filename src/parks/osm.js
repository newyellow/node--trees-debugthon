import { containsPoint } from '../spatial.js';
const equal = (a,b) => a[0] === b[0] && a[1] === b[1];
export function stitch(parts) {
  const todo = parts.map(r => r.map(p => [p.lon,p.lat])), rings = [];
  while (todo.length) {
    const ring = todo.shift();
    if (ring.length < 2) throw new Error('Missing ring geometry');
    while (!equal(ring[0],ring.at(-1))) {
      const i = todo.findIndex(r => equal(r[0],ring.at(-1)) || equal(r.at(-1),ring.at(-1)));
      if (i < 0) throw new Error('Unclosed relation ring');
      const next = todo.splice(i,1)[0];
      if (!equal(next[0],ring.at(-1))) next.reverse();
      ring.push(...next.slice(1));
    }
    if (ring.length < 4) throw new Error('Degenerate ring');
    rings.push(ring);
  }
  return rings;
}
export function convertOverpass(raw) {
  if (!Array.isArray(raw.elements) || raw.remark) throw new Error(raw.remark || 'Invalid Overpass response');
  const features = [], skipped = [], memberIds = new Set();
  for (const e of raw.elements.filter(e => e.type === 'relation' && e.tags?.leisure === 'park')) {
    for (const m of e.members || []) if (m.type === 'way') memberIds.add(m.ref);
    try {
      if (e.tags.type !== 'multipolygon' || !e.members?.length || e.members.some(m => m.type !== 'way' || !['outer','inner',''].includes(m.role) || !m.geometry?.length)) throw new Error('Unsupported relation members');
      const ps = stitch(e.members.filter(m => m.role !== 'inner').map(m => m.geometry)).map(r => [r]);
      for (const ring of stitch(e.members.filter(m => m.role === 'inner').map(m => m.geometry))) {
        const owners = ps.filter(p => ring.every(point => containsPoint(point,{type:'Polygon',coordinates:[p[0]]})));
        if (owners.length !== 1) throw new Error('Ambiguous hole');
        owners[0].push(ring);
      }
      features.push(feature(e,{type:'MultiPolygon',coordinates:ps}));
    } catch (error) { skipped.push({id:'relation/'+e.id,reason:error.message}); }
  }
  for (const e of raw.elements.filter(e => e.type === 'way' && e.tags?.leisure === 'park' && !memberIds.has(e.id))) {
    try { features.push(feature(e,{type:'Polygon',coordinates:stitch([e.geometry || []])})); }
    catch(error) { skipped.push({id:'way/'+e.id,reason:error.message}); }
  }
  return {features,skipped};
}
function feature(e,geometry) { return {type:'Feature',id:e.type+'/'+e.id,properties:{name:e.tags['name:zh'] || e.tags.name || '',names:[...new Set(['name','name:zh','official_name','alt_name'].flatMap(k => (e.tags[k] || '').split(';')).filter(Boolean))],osmVersion:e.version,osmTimestamp:e.timestamp},geometry}; }
