import L from 'leaflet';
import RBush from 'rbush';
import { matches, gridGroups, unionBounds } from './explorer.js';

export function renderPointLayer({ definition, dataset, state, map, bounds, scene, featurePopup, fitBounds, speciesFilter = null, speciesVersion = null, pointColor = null }) {
  const zoom = map.getZoom(), opacity = state.opacity.get(definition.id) ?? 0.8;
  const query = { minX: bounds.getWest(), minY: bounds.getSouth(), maxX: bounds.getEast(), maxY: bounds.getNorth() };
  if (definition.kind === 'polygon' && zoom >= (definition.id === 'tree-pits' ? 18 : 15)) {
    const style = { color: definition.color, weight: 1.5, opacity, fillOpacity: opacity * 0.3 };
    for (const { feature } of dataset.index.search(query)) {
      if (!matches(feature, state.district, state.query)) continue;
      scene.use(`area:${definition.id}:${dataset.featureIds.get(feature)}`, 'geometry', () => L.geoJSON(feature, { pane: 'areas', style }).bindPopup(() => featurePopup(feature, definition), { maxWidth: 340 }), opacity, layer => layer.setStyle(style));
    }
    return;
  }
  const cellSize = definition.id === 'parks' || zoom >= 17 ? 1 : 56;
  const version = JSON.stringify([zoom, cellSize, state.district, state.query, speciesVersion]);
  if (dataset.groupCache?.version !== version) {
    // Build complete world-anchored groups once. A viewport edge never splits a group.
    const features = dataset.features.filter(f => matches(f, state.district, state.query) && (!speciesFilter || speciesFilter(f)));
    const groups = gridGroups(features, coordinate => map.project(coordinate, zoom), cellSize);
    const index = new RBush();
    index.load(groups.map(group => {
      const b = unionBounds(group.features);
      return { minX: Math.min(b[0], group.lng), minY: Math.min(b[1], group.lat), maxX: Math.max(b[2], group.lng), maxY: Math.max(b[3], group.lat), group };
    }));
    dataset.groupCache = { version, index };
  }
  for (const { group } of dataset.groupCache.index.search(query)) {
    const total = group.features.length, key = `point:${definition.id}:${group.key}`;
    scene.use(key, version, () => {
      if (total === 1) return L.circleMarker([group.lat, group.lng], { pane: 'points', radius: definition.id === 'parks' ? 6 : 4, color: '#fff', weight: 1, fillColor: pointColor ? pointColor(group.features[0]) : definition.color, fillOpacity: opacity, opacity }).bindPopup(() => featurePopup(group.features[0], definition), { maxWidth: 340 });
      const size = Math.min(48, 24 + Math.log10(total) * 7);
      const colors = pointColor && new Set(group.features.map(pointColor));
      const marker = pointColor ? L.circleMarker([group.lat, group.lng], { pane: 'points', radius: Math.min(22, size / 2), color: '#fff', weight: 1, fillColor: colors.size === 1 ? [...colors][0] : '#667580', opacity, fillOpacity: opacity }) : L.marker([group.lat, group.lng], { pane: 'points', opacity, icon: L.divIcon({ className: 'cluster-wrap', html: `<span class="cluster" style="--cluster-color:${definition.color};width:${size}px;height:${size}px">${total.toLocaleString('zh-TW')}</span>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }) });
      marker.bindTooltip(`${definition.title} · ${total.toLocaleString('zh-TW')} 筆（點擊放大）`);
      marker.on('click', () => {
        if (map.getZoom() < 19) { fitBounds(unionBounds(group.features), Math.min(19, map.getZoom() + 3)); return; }
        const box = document.createElement('div'); box.className = 'overlap-list';
        const title = document.createElement('strong'); title.textContent = `此處重疊 ${total.toLocaleString('zh-TW')} 筆`; box.append(title);
        for (const feature of group.features) {
          const button = document.createElement('button'); button.textContent = `${feature.properties._name} · ${feature.properties.TreeID ?? feature.properties.ID ?? feature.properties.OBJECTID ?? ''}`;
          button.onclick = () => L.popup({ maxWidth: 340 }).setLatLng([group.lat, group.lng]).setContent(featurePopup(feature, definition)).openOn(map); box.append(button);
        }
        marker.bindPopup(box).openPopup();
      }); return marker;
    }, opacity, layer => total === 1 || pointColor ? layer.setStyle({ opacity, fillOpacity: opacity }) : layer.setOpacity(opacity));
  }
}
