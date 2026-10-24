import proj4 from 'proj4';
import clipping from 'polygon-clipping';
const twd = '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
export const project = p => proj4('EPSG:4326', twd, p);
export const unproject = p => proj4(twd, 'EPSG:4326', p);
export function pixelToWorld(x, y, {z, minX, minY, tileSize=256}) {
 const n=2**z;return [(minX+x/tileSize)/n*360-180, Math.atan(Math.sinh(Math.PI*(1-2*(minY+y/tileSize)/n)))*180/Math.PI];
}
export function area(geometry) {
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 const ringArea=r=>Math.abs(r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2);
 return polygons.reduce((s,p)=>s+ringArea(p[0])-p.slice(1).reduce((s,r)=>s+ringArea(r),0),0);
}
export const classify = a => a<3?null:a<30?'micro':a<1000?'small':a<20000?'medium':'large';
export function isGreen(r,g,b,a=255) { return a>0 && g>35 && g>r*1.10 && g>b*1.06 && 2*g-r-b>18; }
// Four-connected RGB mask, globally assembled BEFORE labeling; holes preserved by union of scanline rectangles.
export function segment(mask,width,height,world,study) {
 const visited=new Uint8Array(mask.length), components=[]; const vertices=new Map(); const vertex=(x,y)=>{const key=x+","+y;if(!vertices.has(key))vertices.set(key,project(world(x,y)).map(v=>Math.round(v*10000)/10000));return vertices.get(key);};
 for(let i=0;i<mask.length;i++) {
  if(mask[i]!==1||visited[i])continue;
  const queue=[i];visited[i]=1;let edge=false;
  for(let j=0;j<queue.length;j++) {const k=queue[j],x=k%width,y=Math.floor(k/width);if(!x||!y||x===width-1||y===height-1)edge=true;
   for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {if(nx<0||ny<0||nx>=width||ny>=height)continue;const n=ny*width+nx;if(mask[n]===255)edge=true;if(mask[n]===1&&!visited[n]){visited[n]=1;queue.push(n);}}
  }
  const rows=new Map();for(const k of queue){const y=Math.floor(k/width);if(!rows.has(y))rows.set(y,[]);rows.get(y).push(k%width);}
  let pieces=[];for(const [y,xs] of rows){xs.sort((a,b)=>a-b);for(let j=0;j<xs.length;){let start=xs[j],end=start+1;while(++j<xs.length&&xs[j]===end)end++;const border=[];for(let x=start;x<=end;x++)border.push([x,y]);for(let x=end;x>=start;x--)border.push([x,y+1]);border.push([start,y]);const r=border.map(p=>vertex(...p));pieces.push([[r]]);}}
  // Hierarchical union bounds argument count and memory; it does not simplify/fill holes.
  while(pieces.length>1){const next=[];for(let j=0;j<pieces.length;j+=32)next.push(clipping.union(...pieces.slice(j,j+32)));pieces=next;}
  let coords=pieces[0];if(study)coords=clipping.intersection(coords,study);
  if(!coords.length)continue;const projected={type:'MultiPolygon',coordinates:coords},m2=area(projected),size=classify(m2);if(!size)continue;
  components.push({type:'Feature',geometry:{type:'MultiPolygon',coordinates:coords.map(p=>p.map(r=>r.map(unproject)))},properties:{areaM2:m2,size,pixelCount:queue.length,coverageEdge:edge,confidence:'unvalidated-color-heuristic',method:'rgb-excess-green-v1'}});
 }
 return components;
}
