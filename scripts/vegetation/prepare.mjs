// Explicit bounded PILOT, not a city downloader. Never run from frontend or pan handlers.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createAerialCache } from '../aerial-cache.mjs';
import { pixelToWorld, project, area, segment, isGreen } from '../../src/vegetation/geometry.js';
import clipping from 'polygon-clipping';
const hash=b=>createHash('sha256').update(b).digest('hex');
const root=new URL('../../',import.meta.url);
// Crosses Songshan/Xinyi boundary near Sun Yat-sen Memorial Hall. 12 tiles / <=2MiB download ceiling.
const grid={z:19,minX:439181,minY:224446,tileSize:256},columns=4,rows=3,budget=2*1024*1024;
let newBytes=0,downloads=0;
const cache=createAerialCache({directory:new URL('data/offline-imagery/tiles',root).pathname,download:async url=>{
 if(++downloads>12)throw Error('12 tile budget exceeded');
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Provider '+response.status+'; no retry');
 const bytes=Buffer.from(await response.arrayBuffer());newBytes+=bytes.length;if(newBytes>budget)throw Error('2 MiB byte budget exceeded');
 await new Promise(r=>setTimeout(r,1000));return bytes;
}});
const regionBytes=await fs.readFile(new URL('public/data/regions.json',root)), regions=JSON.parse(regionBytes),districts=regions.districts.filter(f=>['松山區','信義區'].includes(f.properties.name));
const projected=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates.map(r=>r.map(project))]:f.geometry.coordinates.map(p=>p.map(r=>r.map(project)));
const study=clipping.union(...districts.map(projected));
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
const width=columns*256,height=rows*256,mask=new Uint8Array(width*height).fill(255),inputs=[];
try{for(let y=0;y<rows;y++)for(let x=0;x<columns;x++) {
 const tile={x:grid.minX+x,y:grid.minY+y,z:grid.z};
 const result=await cache.get('/__aerial-cache/PHOTO2/19/'+tile.y+'/'+tile.x);
 const rgba=await page.evaluate(async ({uri})=>{const image=new Image();image.src=uri;await image.decode();if(image.width!==256||image.height!==256)throw Error('Unexpected dimensions');const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.drawImage(image,0,0);return Array.from(c.getImageData(0,0,256,256).data);},{uri:'data:'+result.contentType+';base64,'+result.bytes.toString('base64')});
 for(let py=0;py<256;py++)for(let px=0;px<256;px++){const i=(py*256+px)*4;mask[(y*256+py)*width+x*256+px]=rgba[i+3]===0?255:+isGreen(...rgba.slice(i,i+4));}
 inputs.push({...tile,sha256:hash(result.bytes),bytes:result.bytes.length,source:'https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/19/'+tile.y+'/'+tile.x,captureDate:null});
}}finally{await browser.close();}
const world=(x,y)=>pixelToWorld(x,y,grid), ring=[[0,0],[width,0],[width,height],[0,height],[0,0]].map(p=>project(world(...p)));
const coverageProjected=clipping.intersection([[ring]],study),coverage={type:'Feature',properties:{role:'actual-analysis-coverage'},geometry:{type:'MultiPolygon',coordinates:[]}};
// Conversion is isolated to output; all geometry operations and areas used EPSG:3826.
const {unproject}=await import('../../src/vegetation/geometry.js');coverage.geometry.coordinates=coverageProjected.map(p=>p.map(r=>r.map(unproject)));
const features=segment(mask,width,height,world,study);features.forEach((f,i)=>{f.id='rgb-v1-'+i;Object.assign(f.properties,{source:'NLSC PHOTO2',captureDate:null,uncertainty:'陰影漏判、草地／樹冠／綠屋頂／綠色人工物混淆；非樹種、非NDVI、無人工精度驗證。邊界截斷面積可能低估。',areaCrs:'EPSG:3826'});});
const counts=Object.fromEntries(['roof','micro','small','medium','large'].map(k=>[k,features.filter(f=>f.properties.size===k).length]));
const metadata={schemaVersion:1,method:'rgb-excess-green-v1',methodType:'spectral-color-heuristic-not-learned-model',parameters:{greenMin:35,greenRedRatio:1.10,greenBlueRatio:1.06,excessGreenMin:18,connectivity:4,minAreaM2:3},grid,columns,rows,analysisDisplayMetresPerPixel:156543.03392804097*Math.cos(world(0,0)[1]*Math.PI/180)/2**19,nativeGroundResolutionMetres:null,captureDate:null,areaCrs:'EPSG:3826',outputCrs:'EPSG:4326',regionSha256:hash(regionBytes),inputs,counts,coverage,coverageAreaM2:area({type:'MultiPolygon',coordinates:coverageProjected}),studyAreaM2:area({type:'MultiPolygon',coordinates:study}),coverageComplete:false,roofStatus:'unavailable: no verified roof evidence; non-green remainder is NOT roof',publicationReview:'NLSC terms permit attributed public display, prohibit mass download and removing source marks; derived polygon redistribution requires owner review; raw imagery never published',sourceTerms:'https://maps.nlsc.gov.tw/pro/use_clause.jsp',limitations:'3m² detection is approximate RGB footprint, not ecological forest type or confirmed tree canopy. No pH/soil/planting suitability inference. PHOTO2 is a layer version, NOT capture date.',downloadedTiles:downloads,newBytes};
const data=JSON.stringify({type:'FeatureCollection',features}),digest=hash(data);metadata.geojsonSha256=digest;metadata.file='patches-'+digest.slice(0,16)+'.geojson';const dir=new URL('public/data/vegetation/',root);await fs.mkdir(dir,{recursive:true});await fs.writeFile(new URL(metadata.file,dir),data,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});await fs.writeFile(new URL('pilot.json',dir),JSON.stringify(metadata,null,2));console.log(JSON.stringify({counts,coverageAreaM2:metadata.coverageAreaM2,studyAreaM2:metadata.studyAreaM2,inputs:inputs.length,newBytes}));
