/** Returns a verified interior point in projected coordinates, never a bounds-center fallback.
 * Scanline intervals respect holes. Candidate clearance keeps ink away from edges where possible.
 * Anchor containment is guaranteed; a fixed-size label need not fit every narrow village.
 */
export function interiorAnchor(polygons) {
 let best=null, clearance=-1;
 for(const rings of polygons) {
  const edges=rings.flatMap(r=>r.slice(1).map((p,i)=>[r[i],p]));
  if(!edges.length)continue;
  const ys=[...new Set(rings.flat().map(p=>p[1]))].sort((a,b)=>a-b);
  const samples=ys.slice(1).map((y,i)=>(y+ys[i])/2);
  for(let i=1;i<32;i++)samples.push(ys[0]+(ys.at(-1)-ys[0])*i/32);
  for(const y of samples) {
   const xs=edges.filter(([a,b])=>(a[1]>y)!==(b[1]>y)).map(([a,b])=>a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1])).sort((a,b)=>a-b);
   for(let i=0;i+1<xs.length;i+=2) {
    if(xs[i+1]<=xs[i])continue;
    const p=[(xs[i]+xs[i+1])/2,y];
    const distance=Math.min(...edges.map(([a,b])=>{const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(y-a[1])*dy)/len)):0;return (p[0]-a[0]-t*dx)**2+(y-a[1]-t*dy)**2;}));
    if(distance>clearance&&distance>0){clearance=distance;best=p;}
   }
  }
 }
 return best;
}
