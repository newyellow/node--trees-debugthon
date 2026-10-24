export const TREE_MARKER_SIDE = 12;
export const TREE_MARKER_HIT_RADIUS = 10;
export const TREE_MARKER_DURATION = 360;
export function easeOutBack(t) {
  t=Math.max(0,Math.min(1,t));const c=1.70158,u=t-1;
  return t===0?0:t===1?1:1+(c+1)*u*u*u+c*u*u;
}
export function markerRotation(from,to,elapsed) {
  return from+(to-from)*easeOutBack(elapsed/TREE_MARKER_DURATION);
}
export function squarePath(ctx,point,angle=0) {
  ctx.translate(point.x,point.y);ctx.rotate(angle);ctx.beginPath();
  ctx.rect(-TREE_MARKER_SIDE/2,-TREE_MARKER_SIDE/2,TREE_MARKER_SIDE,TREE_MARKER_SIDE);
}
