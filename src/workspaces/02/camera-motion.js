/** One interruptible camera owner; diagnostics are observations, never a test setter. */
export function createCameraMotion(map, {host = map.getContainer(), media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')} = {}) {
  let sequence = 0, active = null;
  const publish = phase => {
    host.dataset.cameraPhase = phase;
    host.dataset.cameraZoom = String(map.getZoom());
    const center = map.getCenter();
    host.dataset.cameraLat = String(center.lat); host.dataset.cameraLng = String(center.lng);
  };
  const end = () => { active = null; publish('idle'); };
  const start = () => publish('moving');
  const update = () => publish(host.dataset.cameraPhase || 'idle');
  map.on('movestart zoomstart', start); map.on('move zoom', update); map.on('moveend', end);
  function cancel() {
    ++sequence; active = null;
    if(map._animatingZoom) map._onZoomTransitionEnd(); map.stop(); // stop before reading center: Leaflet may finish its current frame here.
    publish('idle');
  }
  function run(target, options = {}, instant = false) {
    cancel();
    const token = sequence;
    const animate = !instant && !media?.matches;
    const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), target.zoom));
    const center = target.center;
    if (Math.abs(map.getZoom() - zoom) < 1e-9 && map.getCenter().equals(center, 1e-9)) return;
    active = {center, zoom, token}; publish('moving');
    if (animate) map.flyTo(center, zoom, {...options, animate: true, duration: options.duration ?? .45});
    else map.setView(center, zoom, {animate: false});
    // Instant and no-op maps need no delayed callback (which could refocus a newer selection).
    if (!animate && token === sequence) end();
  }
  function fit(bounds, options = {}, instant = false) {
    // Native bounds calculation retains exact asymmetric padding and fractional zoom.
    cancel();
    const target = map._getBoundsCenterZoom(bounds, options);
    run(target, options, instant);
  }
  function pullback() {
    cancel();
    run({center: map.getCenter(), zoom: Math.max(map.getMinZoom(), map.getZoom() - 1.25)}, {duration: .4});
  }
  const input = event => {
    // Controls/panels have their own camera intent; do not cancel for unrelated UI scrolling.
    if(event.target?.closest?.('.leaflet-control-zoom')) {if(active)cancel();return;} if (event.target?.closest?.('.surface,.leaflet-control,.leaflet-popup')) return;
    if (active) cancel();
  };
  const container = map.getContainer();
  for (const type of ['wheel', 'touchstart', 'pointerdown']) container.addEventListener(type, input, {passive: true, capture: true});
  const dragStart = () => {if(active) cancel();}; map.on('dragstart', dragStart);
  const reducedChange = () => {
    // Changing preference during a flight settles its current destination, not an obsolete one.
    const target = active;
    if (media?.matches && target) run(target, {}, true);
    map.options.zoomAnimation = !media?.matches;
    map.options.fadeAnimation = !media?.matches;
    map.options.markerZoomAnimation = !media?.matches;
    map._zoomAnimated = !media?.matches && zoomAnimatedSupported;
  };
  // Leaflet's capability decision is retained when re-enabling a live preference.
  const zoomAnimatedSupported = !!map._zoomAnimated;
  reducedChange(); media?.addEventListener('change', reducedChange);
  publish('idle');
  return {cancel, fit, pullback, run, isMoving:()=>host.dataset.cameraPhase==='moving', destroy() {
    cancel(); media?.removeEventListener('change', reducedChange);
    map.off('movestart zoomstart', start); map.off('move zoom', update); map.off('moveend', end); map.off('dragstart', dragStart);
    for (const type of ['wheel', 'touchstart', 'pointerdown']) container.removeEventListener(type, input, true);
  }};
}
