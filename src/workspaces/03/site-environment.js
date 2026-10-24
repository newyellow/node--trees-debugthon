// Explicit clicked-point terrain lookup; no photo, browser location, auth or persistence.
export const ELEVATION_SOURCE='Open-Meteo / Copernicus DEM 2021 GLO-90（90 m 地形估算，非現地或樓層高度）';
export const ELEVATION_DOCS='https://open-meteo.com/en/docs/elevation-api';
const unavailable=(status='unavailable')=>({value:null,source:ELEVATION_SOURCE,status});
export function elevationURL({lat,lng}) {
 if(typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<24.9||lat>25.3||lng<121.4||lng>121.7)throw Error('座標超出臺北研究範圍');
 const u=new URL('https://api.open-meteo.com/v1/elevation');u.searchParams.set('latitude',lat.toFixed(4));u.searchParams.set('longitude',lng.toFixed(4));return u.href;
}
export function createElevationLookup(fetcher=fetch,now=()=>Date.now()) {
 const cache=new Map();let lastStart=-Infinity,cooldown=0;
 return async ({lat,lng,signal}={})=>{
  let url;try{url=elevationURL({lat,lng});}catch{return unavailable();}
  if(signal?.aborted)return unavailable();
  if(cache.has(url))return {...cache.get(url)};
  if(now()<cooldown||now()-lastStart<1000)return unavailable('rate-limited');
  lastStart=now();const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,8000);
  try{
   const r=await fetcher(url,{method:'GET',signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
   if(!r.ok){if(r.status===429){const v=r.headers?.get('Retry-After');const delay=Number(v);cooldown=Math.max(now()+60000,v&&Number.isFinite(delay)?now()+delay*1000:Date.parse(v)||0);}return unavailable(r.status===429?'rate-limited':'unavailable');}
   const data=await r.json(),value=data?.elevation?.[0];
   if(controller.signal.aborted||!Array.isArray(data?.elevation)||data.elevation.length!==1||typeof value!=='number'||!Number.isFinite(value)||value< -500||value>9000)return unavailable();
   const result={value:Math.round(value),source:ELEVATION_SOURCE,status:'ok'};cache.set(url,result);if(cache.size>32)cache.delete(cache.keys().next().value);return {...result};
  }catch{return unavailable();}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 };
}
export const lookupElevation=createElevationLookup();
