export function matches(feature, district, query) {
  const p = feature.properties;
  if (district && p._district !== district) return false;
  if (!query) return true;
  const searchable = ['TreeID', 'TreeType', 'Region', 'RegionRemark', 'ParkName', 'NAME_Road', 'PSTART', 'PEND', 'Name', 'ID', 'OBJECTID', 'pm_name', 'pm_name_eng', 'pm_location'];
  return searchable.some(key => String(p[key] ?? '').toLocaleLowerCase().includes(query));
}
export function unionBounds(items) {
  if (!items.length) return null;
  return items.reduce((b, item) => {
    const v = item.bbox ?? [item.minX, item.minY, item.maxX, item.maxY];
    return [Math.min(b[0], v[0]), Math.min(b[1], v[1]), Math.max(b[2], v[2]), Math.max(b[3], v[3])];
  }, [Infinity, Infinity, -Infinity, -Infinity]);
}
export function gridGroups(features, project, cellSize) {
  const cells = new Map();
  for (const feature of features) {
    const [w, s, e, n] = feature.bbox;
    const point = project([(s + n) / 2, (w + e) / 2]);
    const key = `${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`;
    let cell = cells.get(key);
    if (!cell) { cell = { key, features: [], lat: 0, lng: 0 }; cells.set(key, cell); }
    cell.features.push(feature); cell.lat += (s + n) / 2; cell.lng += (w + e) / 2;
  }
  return [...cells.values()].map(c => ({ ...c, lat: c.lat / c.features.length, lng: c.lng / c.features.length }));
}
