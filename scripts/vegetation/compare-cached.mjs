// Never imports createAerialCache; direct local reads only, fail closed.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {chromium} from '@playwright/test';
import {classifyRGB,VERSION,PARAMS,classifyHysteresis,HYSTERESIS_VERSION,HYSTERESIS_PARAMS,strictGateDiagnostics} from '../../src/vegetation/candidates.js';
const root=new URL('../../',import.meta.url),out=new URL('test-results/vegetation-comparison/',root);
const hash=b=>createHash('sha256').update(b).digest('hex');
const start=performance.now(),pilotBytes=await fs.readFile(new URL('public/data/vegetation/pilot.json',root)),pilot=JSON.parse(pilotBytes);
const expected=[];for(let y=224446;y<=224448;y++)for(let x=439181;x<=439184;x++)expected.push('19/'+y+'/'+x);
if(pilot.inputs.length!==12||new Set(pilot.inputs.map(t=>t.z+'/'+t.y+'/'+t.x)).size!==12||pilot.inputs.some(t=>!expected.includes(t.z+'/'+t.y+'/'+t.x)))throw Error('Not exact cached12');
if(pilot.grid.z!==19||pilot.grid.minX!==439181||pilot.grid.minY!==224446||pilot.grid.tileSize!==256||pilot.columns!==4||pilot.rows!==3)throw Error('Grid mismatch');
const files=[];for(const id of expected){const t=pilot.inputs.find(t=>t.z+'/'+t.y+'/'+t.x===id);let bytes,name;
 for(const ext of ['jpg','png']){try{name='data/offline-imagery/tiles/PHOTO2/'+id+'.'+ext;bytes=await fs.readFile(new URL(name,root));break;}catch(e){if(e.code!=='ENOENT')throw e;}}
 if(!bytes)throw Error('Missing cached '+id+'; no download fallback');if(hash(bytes)!==t.sha256||bytes.length!==t.bytes)throw Error('SHA/size mismatch '+id);
 files.push({id,sha256:hash(bytes),bytes:bytes.length,uri:'data:image/'+(name.endsWith('.png')?'png':'jpeg')+';base64,'+bytes.toString('base64')});
}
await fs.mkdir(out,{recursive:true});
const width=1024,height=768,rgba=new Uint8Array(width*height*4);
const browser=await chromium.launch({channel:'chrome',headless:true});let page;
try{page=await browser.newPage();await page.route('**/*',route=>route.abort());
 for(let k=0;k<files.length;k++){
  const pixels=await page.evaluate(async uri=>{const im=new Image();im.src=uri;await im.decode();if(im.width!==256||im.height!==256)throw Error('Dimension mismatch');const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return Array.from(ctx.getImageData(0,0,256,256).data);},files[k].uri);
  for(let y=0;y<256;y++)rgba.set(pixels.slice(y*1024,(y+1)*1024),((Math.floor(k/4)*256+y)*width+k%4*256)*4);
 }
 const decodeMs=performance.now()-start,reports=[],results={};
 for(const name of ['normalized','normalized-edge','baseline-hysteresis']){const t=performance.now(),r=name==='baseline-hysteresis'?classifyHysteresis(rgba,width,height):classifyRGB(rgba,width,height,{smoothing:name==='normalized-edge'});const computeMs=performance.now()-t;results[name]=r;
  for(const [stage,mask] of Object.entries(r)){await fs.writeFile(new URL(name+'-'+stage+'.u8',out),mask);}
  const stats=(indices)=>{const counts={pixels:0,valid:0,nodata:0,unknown:0,known:0,baselineGreen:0,preGreen:0,postGreen:0,gained:0,lost:0,baselineGreenOnUnknown:0,retainedBaseline:0};for(const i of indices){counts.pixels++;if(!r.valid[i]){counts.nodata++;continue;}counts.valid++;counts.unknown+=r.unknown[i];counts.known+=1-r.unknown[i];counts.baselineGreen+=+(r.baseline[i]===1);counts.retainedBaseline+=+(r.baseline[i]===1&&r.post[i]===1);counts.preGreen+=+(r.pre[i]===1);counts.postGreen+=+(r.post[i]===1);if(r.unknown[i]){counts.baselineGreenOnUnknown+=+(r.baseline[i]===1);continue;}counts.gained+=+(r.post[i]===1&&r.baseline[i]===0);counts.lost+=+(r.post[i]===0&&r.baseline[i]===1);}
   return {...counts,approxDisplayAreaM2:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v*pilot.analysisDisplayMetresPerPixel**2]))};};
  reports.push({name,computeMs,masks:Object.fromEntries(Object.entries(r).map(([k,v])=>[k,{sha256:hash(v),bytes:v.length}])),fullGrid:stats(Array.from({length:width*height},(_,i)=>i)),tiles:files.map((f,k)=>({id:f.id,...stats(Array.from({length:65536},(_,i)=>(Math.floor(k/4)*256+Math.floor(i/256))*width+k%4*256+i%256))}))});
 }
 const panels=[['original',null],['baseline',results.normalized.baseline],...Object.entries(results).map(([name,r])=>[name,r.post])];
 const rgba64=Buffer.from(rgba).toString('base64');
 await page.evaluate(({width,height,rgba64,count})=>{window.originalRGBA=Uint8ClampedArray.from(atob(rgba64),c=>c.charCodeAt(0));window.preview=document.createElement('canvas');preview.width=width*2;preview.height=Math.ceil(count/2)*(height+32);window.pctx=preview.getContext('2d');pctx.fillStyle='#222';pctx.fillRect(0,0,preview.width,preview.height);},{width,height,rgba64,count:panels.length});
 for(let k=0;k<panels.length;k++){const [name,mask]=panels[k];await page.evaluate(({name,k,width,height,mask64})=>{const data=originalRGBA.slice(),mask=mask64?Uint8Array.from(atob(mask64),c=>c.charCodeAt(0)):null;if(mask)for(let i=0;i<mask.length;i++){if(mask[i]===1){data[i*4]=30;data[i*4+1]=255;data[i*4+2]=90;}else if(mask[i]===255){data[i*4]=190;data[i*4+1]=80;data[i*4+2]=190;}}const x=k%2*width,y=Math.floor(k/2)*(height+32);pctx.fillStyle='white';pctx.font='16px sans-serif';pctx.fillText('PRIVATE '+name+' / source marks retained',x+8,y+22);pctx.putImageData(new ImageData(data,width,height),x,y+32);},{name,k,width,height,mask64:mask?Buffer.from(mask).toString('base64'):null});}
 const png=await page.evaluate(()=>preview.toDataURL('image/png').split(',')[1]);
 await fs.writeFile(new URL('private-mosaic.png',out),Buffer.from(png,'base64'));
 const sourceHashes={};for(const path of ['src/vegetation/candidates.js','src/vegetation/geometry.js','scripts/vegetation/compare-cached.mjs'])sourceHashes[path]=hash(await fs.readFile(new URL(path,root)));
 const report={version:VERSION,parameters:PARAMS,hysteresisVersion:HYSTERESIS_VERSION,hysteresisParameters:HYSTERESIS_PARAMS,strictGateDiagnostics:strictGateDiagnostics(rgba),sourceHashes,pilotSha256:hash(pilotBytes),inputs:files.map(({uri,...f})=>f),grid:{width,height},displayMetresPerPixel:pilot.analysisDisplayMetresPerPixel,nativeGSD:null,captureDate:null,truth:null,accuracy:null,areaPolicy:'Approximate full-grid display-sample m² only; NOT projected study-clipped EPSG:3826 area. No 3m² component filtering. pre/post = local support ablation, not evaluation API production stages.',watermarkPolicy:'Original panel untouched; marks retained in source; no manual watermark-ignore supplied, obstruction remains unquantified.',limits:{tiles:12,pixels:width*height,networkImageryRequests:0,extraDependencies:0},decodeMs,reports,totalMs:performance.now()-start,peakRssBytes:process.resourceUsage().maxRSS*1024,runtime:process.version,chrome:browser.version()};
 await fs.writeFile(new URL('comparison.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
