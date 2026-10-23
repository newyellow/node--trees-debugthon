export function polygons(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
}
export function mapGeometry(geometry, transform) {
  return { type: geometry.type, coordinates: geometry.type === 'Polygon' ? geometry.coordinates.map(r => r.map(transform)) : geometry.coordinates.map(p => p.map(r => r.map(transform))) };
}
export function metricBounds(geometry) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygons(geometry)) for (const ring of polygon) for (const [x, y] of ring) {
    b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
  }
  return b;
}
export function segmentDistance(point, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = dx || dy ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}
// Boundary: 0, interior: 1, exterior: -1.
function inRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if (segmentDistance(point, a, b) < 1e-6) return 0;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? 1 : -1;
}
export function containsPoint(point, geometry) {
  return polygons(geometry).some(polygon => {
    if (inRing(point, polygon[0]) === -1) return false;
    return !polygon.slice(1).some(ring => inRing(point, ring) === 1);
  });
}
export function geometryDistance(point, geometry) {
  if (containsPoint(point, geometry)) return 0;
  let min = Infinity;
  for (const polygon of polygons(geometry)) for (const ring of polygon) for (let i = 1; i < ring.length; i++) min = Math.min(min, segmentDistance(point, ring[i - 1], ring[i]));
  return min;
}
export function geometryArea(geometry) {
  const ringArea = ring => {
    const [ox, oy] = ring[0];
    let sum = 0;
    for (let i = 1; i < ring.length; i++) sum += (ring[i - 1][0] - ox) * (ring[i][1] - oy) - (ring[i][0] - ox) * (ring[i - 1][1] - oy);
    return Math.abs(sum / 2);
  };
  return polygons(geometry).reduce((sum, polygon) => sum + ringArea(polygon[0]) - polygon.slice(1).reduce((a, r) => a + ringArea(r), 0), 0);
}
// Uniform, perimeter-weighted outer-ring samples, independent of vertex spacing.
export function perimeterSamples(geometry, spacing = 10) {
  const samples = [];
  for (const polygon of polygons(geometry)) {
    const ring = polygon[0], lengths = ring.slice(1).map((p, i) => Math.hypot(p[0] - ring[i][0], p[1] - ring[i][1]));
    const total = lengths.reduce((a, b) => a + b, 0);
    if (!total) continue;
    const n = Math.max(1, Math.ceil(total / spacing)), step = total / n;
    let segment = 0, start = 0;
    for (let i = 0; i < n; i++) {
      const position = (i + 0.5) * step;
      while (segment < lengths.length - 1 && start + lengths[segment] < position) start += lengths[segment++];
      const t = lengths[segment] ? (position - start) / lengths[segment] : 0;
      samples.push({ point: [ring[segment][0] + t * (ring[segment + 1][0] - ring[segment][0]), ring[segment][1] + t * (ring[segment + 1][1] - ring[segment][1])], weight: step });
    }
  }
  return samples;
}
