import proj4 from 'proj4';

const projection = proj4('EPSG:4326', '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
const positions = new WeakMap();
export const TREE_LAYERS = new Set(['street-trees', 'park-trees']);
export const DENSITY_STOPS = [
  { value: 0, color: '#d86450' },
  { value: 5, color: '#efc654' },
  { value: 10, color: '#acc856' },
  { value: 20, color: '#287b43' },
];
export const toMeters = coordinate => projection.forward(coordinate);
export const toLngLat = coordinate => projection.inverse(coordinate);

// A fixed metric origin keeps cells identical across panning, zooming and filters.
export function buildDensityGrid(datasets, cellSize) {
  if (![100, 250, 500].includes(cellSize)) throw new RangeError('Unsupported grid size');
  const cells = new Map();
  const extent = [Infinity, Infinity, -Infinity, -Infinity];
  let total = 0;
  for (const { id, features } of datasets) {
    if (!TREE_LAYERS.has(id)) continue;
    for (const feature of features) {
      if (feature.geometry?.type !== 'Point') continue;
      let position = positions.get(feature);
      if (!position) { position = toMeters(feature.geometry.coordinates); positions.set(feature, position); }
      const x = Math.floor(position[0] / cellSize), y = Math.floor(position[1] / cellSize);
      const key = `${x},${y}`;
      let cell = cells.get(key);
      if (!cell) { cell = { x, y, count: 0, byLayer: {} }; cells.set(key, cell); }
      cell.count++; cell.byLayer[id] = (cell.byLayer[id] ?? 0) + 1; total++;
      extent[0] = Math.min(extent[0], x); extent[1] = Math.min(extent[1], y);
      extent[2] = Math.max(extent[2], x); extent[3] = Math.max(extent[3], y);
    }
  }
  return { cells, cellSize, extent: total ? extent : null, total };
}

export function cellDensity(count, cellSize) { return count / (cellSize * cellSize / 10000); }
export function densityColor(density) {
  const value = Math.max(0, density);
  for (let i = 1; i < DENSITY_STOPS.length; i++) {
    const a = DENSITY_STOPS[i - 1], b = DENSITY_STOPS[i];
    if (value > b.value) continue;
    const ratio = (value - a.value) / (b.value - a.value);
    const rgb = [1, 3, 5].map(offset => Math.round(parseInt(a.color.slice(offset, offset + 2), 16) * (1 - ratio) + parseInt(b.color.slice(offset, offset + 2), 16) * ratio));
    return `#${rgb.map(n => n.toString(16).padStart(2, '0')).join('')}`;
  }
  return DENSITY_STOPS.at(-1).color;
}

// Query whole cells, including zero-record cells, inside the dataset's bounding rectangle.
export function visibleDensityCells(grid, bounds) {
  if (!grid.extent) return [];
  const corners = [[bounds[0], bounds[1]], [bounds[0], bounds[3]], [bounds[2], bounds[1]], [bounds[2], bounds[3]]].map(toMeters);
  const xs = corners.map(p => Math.floor(p[0] / grid.cellSize)), ys = corners.map(p => Math.floor(p[1] / grid.cellSize));
  const minX = Math.max(grid.extent[0], Math.min(...xs)), maxX = Math.min(grid.extent[2], Math.max(...xs));
  const minY = Math.max(grid.extent[1], Math.min(...ys)), maxY = Math.min(grid.extent[3], Math.max(...ys));
  const result = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const cell = grid.cells.get(`${x},${y}`) ?? { x, y, count: 0, byLayer: {} };
      const size = grid.cellSize;
      const ring = [[x * size, y * size], [(x + 1) * size, y * size], [(x + 1) * size, (y + 1) * size], [x * size, (y + 1) * size]].map(toLngLat);
      result.push({ ...cell, density: cellDensity(cell.count, size), ring });
    }
  }
  return result;
}
