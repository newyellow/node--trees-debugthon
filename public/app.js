const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const visual = document.querySelector('.key-visual');
const colors = ['#97ca46', '#a0c69f', '#014f35'];
const cells = [...document.querySelectorAll('.pixel')].map(pixel => {
  const x = Number(pixel.getAttribute('x')) + Number(pixel.getAttribute('width')) / 2;
  const y = Number(pixel.getAttribute('y')) + Number(pixel.getAttribute('height')) / 2;
  return {pixel, x, y, base: pixel.getAttribute('fill'), column: Math.round(x / 63.675), row: Math.round(y / 63.675), pulseStart: -Infinity, fill: null, visible: null};
});
let heroVisible = true;
let timer = null;
let lastPoint = null;
let lastPointerTime = -Infinity;
const startedAt = performance.now();
function paint(cell, fill, visible) {
  if (cell.fill !== fill) {cell.pixel.setAttribute('fill', fill); cell.fill = fill;}
  if (cell.visible !== visible) {cell.pixel.style.opacity = visible ? '1' : '0'; cell.visible = visible;}
}
function render() {
  const now = performance.now();
  const tick = Math.floor((now - startedAt) / 420);
  cells.forEach(cell => {
    let fill = cell.base;
    let visible = true;
    const phase = ((tick - cell.column - cell.row * 2) % 28 + 28) % 28;
    if (phase === 0) visible = false;
    else if (phase <= 3) fill = colors[phase - 1];
    const pulse = now - cell.pulseStart;
    if (pulse >= 0 && pulse < 720) {
      visible = true;
      fill = colors[Math.floor(pulse / 240)];
    }
    paint(cell, fill, visible);
  });
}
function syncPlayback() {
  clearInterval(timer);
  timer = null;
  const playing = !reducedMotion.matches && !document.hidden && heroVisible;
  document.body.classList.toggle('motion-idle', !playing);
  if (reducedMotion.matches) cells.forEach(cell => {cell.pulseStart = -Infinity; paint(cell, cell.base, true);});
  else if (playing) {render(); timer = setInterval(render, 120);}
}
function bitRipple(event) {
  if (reducedMotion.matches || !heroVisible || document.hidden) return;
  const now = performance.now();
  const bounds = visual.getBoundingClientRect();
  // Match the SVG's xMidYMid slice crop at every viewport ratio.
  const scale = Math.max(bounds.width / 1920, bounds.height / 1080);
  const offsetX = (bounds.width - 1920 * scale) / 2;
  const offsetY = (bounds.height - 1080 * scale) / 2;
  const x = (event.clientX - bounds.left - offsetX) / scale;
  const y = (event.clientY - bounds.top - offsetY) / scale;
  if (event.type !== 'pointerdown' && (now - lastPointerTime < 160 || (lastPoint && Math.hypot(x - lastPoint.x, y - lastPoint.y) < 55))) return;
  lastPointerTime = now;
  lastPoint = {x, y};
  cells.forEach(cell => {
    const ring = Math.floor(Math.hypot(cell.x - x, cell.y - y) / 64);
    if (ring < 3) cell.pulseStart = now + ring * 160;
  });
  render();
}
visual.addEventListener('pointermove', bitRipple);
visual.addEventListener('pointerdown', bitRipple);
visual.addEventListener('pointerleave', () => {lastPoint = null;});
reducedMotion.addEventListener('change', syncPlayback);
document.addEventListener('visibilitychange', syncPlayback);
new IntersectionObserver(entries => {heroVisible = entries[0].isIntersecting; syncPlayback();}).observe(visual);
syncPlayback();
