import proj4 from 'proj4';

export const districts = ['松山區', '信義區', '大安區', '中山區', '中正區', '大同區', '萬華區', '文山區', '南港區', '內湖區', '士林區', '北投區'];
const twd97 = '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
export function districtName(value) {
  const text = String(value ?? '').trim();
  if (/^63000\d{3}$/.test(text)) return districts[Number(text.slice(5)) / 10 - 1] ?? text;
  return text.replace('台北市', '').replace('臺北市', '');
}
export function finiteNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function validCoordinate(coordinate) {
  return Array.isArray(coordinate) && coordinate.length >= 2 && coordinate.every(Number.isFinite)
    && coordinate[0] >= 121.4 && coordinate[0] <= 121.7 && coordinate[1] >= 24.9 && coordinate[1] <= 25.25;
}
export function toWgs84(x, y) {
  const easting = finiteNumber(x), northing = finiteNumber(y);
  if (easting === null || northing === null) return null;
  const result = proj4(twd97, 'EPSG:4326', [easting, northing]).map(n => Math.round(n * 1e7) / 1e7);
  return validCoordinate(result) ? result : null;
}
export function convertGeometry(geometry) {
  if (!geometry || !['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(geometry.type)) return null;
  let valid = true;
  function walk(coordinates) {
    if (!Array.isArray(coordinates) || !coordinates.length) { valid = false; return []; }
    if (typeof coordinates[0] !== 'object') {
      const point = toWgs84(coordinates[0], coordinates[1]);
      if (!point) valid = false;
      return point;
    }
    return coordinates.map(walk);
  }
  const coordinates = walk(geometry.coordinates);
  return valid ? { type: geometry.type, coordinates } : null;
}
export function geometryBounds(geometry) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  function walk(c) {
    if (typeof c[0] === 'number') {
      bounds[0] = Math.min(bounds[0], c[0]); bounds[1] = Math.min(bounds[1], c[1]);
      bounds[2] = Math.max(bounds[2], c[0]); bounds[3] = Math.max(bounds[3], c[1]);
    } else c.forEach(walk);
  }
  walk(geometry.coordinates);
  return bounds;
}
