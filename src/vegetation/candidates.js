// Offline experiment only; no canopy/grass/roof inference.
import { isGreen } from './geometry.js';
export const VERSION='normalized-rgb-experimental-v1';
export const PARAMS=Object.freeze({darkMax:40,saturationMin:0.12,hueMin:65,hueMax:170,strongExG:0.12,strongGLI:0.08,weakExG:0.06,weakGLI:0.04,smoothingRadius:1,colorDistanceMax:24,supportRadius:1,strongNeighbors:2});
export function features(r,g,b){
 const sum=r+g+b,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 let hue=0;if(d){hue=max===r?60*(((g-b)/d)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);if(hue<0)hue+=360;}
 return {exg:sum?(2*g-r-b)/sum:0,gli:sum+g?(2*g-r-b)/(sum+g):0,value:max,saturation:max?d/max:0,hue};
}
// pre: independent gate. post: one synchronous local weak-support pass, NOT 3m² filtering.
export function classifyRGB(rgba,width,height,{smoothing=false,validMask}={}){
 const n=width*height;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||n>1024*768||rgba.length!==n*4)throw Error('Invalid grid or > cached12 bound');
 if(typeof smoothing!=='boolean'||(validMask&&validMask.length!==n))throw Error('Invalid options');
 for(const v of rgba)if(!Number.isInteger(v)||v<0||v>255)throw Error('RGBA must be bytes');
 if(validMask)for(const v of validMask)if(![0,1,false,true].includes(v))throw Error('Invalid validity');
 const valid=new Uint8Array(n),unknown=new Uint8Array(n),baseline=new Uint8Array(n),pre=new Uint8Array(n),weak=new Uint8Array(n);
 const original=i=>features(rgba[i*4],rgba[i*4+1],rgba[i*4+2]);
 for(let i=0;i<n;i++){valid[i]=+(rgba[i*4+3]>0&&(!validMask||!!validMask[i]));unknown[i]=+(valid[i]&&(original(i).value<=PARAMS.darkMax||original(i).saturation<PARAMS.saturationMin));}
 for(let i=0;i<n;i++){
  if(!valid[i]){baseline[i]=pre[i]=255;continue;}
  baseline[i]=+isGreen(...rgba.slice(i*4,i*4+4));
  if(unknown[i]){pre[i]=255;continue;}
  let f=original(i);
  if(smoothing){let r=0,g=0,b=0,count=0;const x=i%width,y=Math.floor(i/width);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=width||yy>=height)continue;const j=yy*width+xx;
    if(!valid[j]||unknown[j])continue;
    if(Math.max(...[0,1,2].map(c=>Math.abs(rgba[j*4+c]-rgba[i*4+c])))>PARAMS.colorDistanceMax)continue;
    r+=rgba[j*4];g+=rgba[j*4+1];b+=rgba[j*4+2];count++;
   }f=features(r/count,g/count,b/count);
  }
  const guard=f.hue>=PARAMS.hueMin&&f.hue<=PARAMS.hueMax&&f.saturation>=PARAMS.saturationMin;
  pre[i]=+(guard&&f.exg>=PARAMS.strongExG&&f.gli>=PARAMS.strongGLI);
  weak[i]=+(guard&&f.exg>=PARAMS.weakExG&&f.gli>=PARAMS.weakGLI);
 }
 const post=pre.slice();
 for(let i=0;i<n;i++)if(pre[i]===0&&weak[i]){
  const x=i%width,y=Math.floor(i/width);let support=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const xx=x+dx,yy=y+dy;if((!dx&&!dy)||xx<0||yy<0||xx>=width||yy>=height)continue;
   if(pre[yy*width+xx]===1)support++;
  }if(support>=PARAMS.strongNeighbors)post[i]=1;
 }
 return {baseline,pre,post,valid,unknown};
}

export const HYSTERESIS_VERSION='baseline-preserving-hysteresis-v2';
export const HYSTERESIS_PARAMS=Object.freeze({darkMax:40,ambiguousSaturation:0.04,hueMin:45,hueMax:180,weakExG:0.035,weakGLI:0.025,greenRedRatio:1.015,greenBlueRatio:1.015,supportRadius:1,baselineNeighbors:2,connectivity:4,passes:1});
// Baseline is a fixed seed, never erased by unknown or HSV guards. No iterative growth.
export function classifyHysteresis(rgba,width,height,{validMask}={}){
 const n=width*height;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||n>1024*768||rgba.length!==n*4)throw Error('Invalid grid');
 if(validMask&&validMask.length!==n)throw Error('Invalid validity');
 if(validMask)for(const v of validMask)if(![0,1,false,true].includes(v))throw Error('Invalid validity');
 for(const v of rgba)if(!Number.isInteger(v)||v<0||v>255)throw Error('RGBA must be bytes');
 const baseline=new Uint8Array(n),pre=new Uint8Array(n),valid=new Uint8Array(n),unknown=new Uint8Array(n),weak=new Uint8Array(n),p=HYSTERESIS_PARAMS;
 for(let i=0;i<n;i++){
  const o=i*4,r=rgba[o],g=rgba[o+1],b=rgba[o+2];valid[i]=+(rgba[o+3]>0&&(!validMask||!!validMask[i]));
  if(!valid[i]){baseline[i]=pre[i]=255;continue;}
  baseline[i]=+isGreen(r,g,b,rgba[o+3]);
  if(baseline[i]){pre[i]=1;continue;}
  const f=features(r,g,b);unknown[i]=+(f.value<=p.darkMax||f.saturation<p.ambiguousSaturation);
  pre[i]=unknown[i]?255:0;
  weak[i]=+(!unknown[i]&&f.hue>=p.hueMin&&f.hue<=p.hueMax&&f.exg>=p.weakExG&&f.gli>=p.weakGLI&&g>=r*p.greenRedRatio&&g>=b*p.greenBlueRatio);
 }
 const post=pre.slice();
 for(let i=0;i<n;i++)if(weak[i]){
  const x=i%width,y=Math.floor(i/width);let count=0;
  // Four-neighbor seed contact cannot jump across a nodata/unknown diagonal barrier.
  if(x>0&&baseline[i-1]===1)count++;
  if(x+1<width&&baseline[i+1]===1)count++;
  if(y>0&&baseline[i-width]===1)count++;
  if(y+1<height&&baseline[i+width]===1)count++;
  if(count>=p.baselineNeighbors)post[i]=1;
 }
 return {baseline,pre,post,valid,unknown};
}
// Independent reason gates overlap: do not sum these as mutually exclusive losses.
export function strictGateDiagnostics(rgba){
 const result={valid:0,baselineGreen:0,baselinePassAll:0,gates:{dark:0,lowSaturation:0,hueBelow:0,hueAbove:0,exgBelow:0,gliBelow:0},baselineGates:{dark:0,lowSaturation:0,hueBelow:0,hueAbove:0,exgBelow:0,gliBelow:0},hueBins:[0,0,0,0,0,0,0],saturationBins:[0,0,0,0,0]};
 for(let o=0;o<rgba.length;o+=4){if(!rgba[o+3])continue;result.valid++;const r=rgba[o],g=rgba[o+1],b=rgba[o+2],f=features(r,g,b),base=isGreen(r,g,b,rgba[o+3]);
  const gates={dark:f.value<=40,lowSaturation:f.saturation<0.12,hueBelow:f.hue<65,hueAbove:f.hue>170,exgBelow:f.exg<0.12,gliBelow:f.gli<0.08};
  for(const [k,v] of Object.entries(gates)){result.gates[k]+=+v;if(base)result.baselineGates[k]+=+v;}
  if(base){result.baselineGreen++;if(!Object.values(gates).some(Boolean))result.baselinePassAll++;result.hueBins[[45,65,90,120,170,180,361].findIndex(v=>f.hue<v)]++;result.saturationBins[[0.04,0.12,0.25,0.5,1.01].findIndex(v=>f.saturation<v)]++;}
 }return {...result,hueBinUpperBounds:[45,65,90,120,170,180,361],saturationBinUpperBounds:[0.04,0.12,0.25,0.5,1.01]};
}
