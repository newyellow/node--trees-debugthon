// Manual-only bounded OSM snapshot; one request, no automatic retries.
import { writeFile,rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { convertOverpass } from '../src/parks/osm.js';
import { validateSnapshot } from '../src/parks/data.js';
export const query = '[out:json][timeout:90];(way["leisure"="park"](24.95,121.45,25.21,121.67);relation["leisure"="park"]["type"="multipolygon"](24.95,121.45,25.21,121.67););out meta geom;';
export async function download(fetcher = fetch,endpoint = 'https://overpass-api.de/api/interpreter') {
  const response = await fetcher(endpoint,{method:'POST',body:new URLSearchParams({data:query}),headers:{'User-Agent':'TreesDebugthon park-boundary manual snapshot/1.0'},signal:AbortSignal.timeout(120000)});
  if (!response.ok) throw new Error('Overpass HTTP '+response.status+'; Retry-After: '+(response.headers.get('retry-after') || 'not supplied')+'. No automatic retry; wait before manual retry.');
  return response.json();
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const raw = await download(), {features,skipped} = convertOverpass(raw);
  const snapshot = {type:'FeatureCollection',metadata:{schemaVersion:1,version:'osm-'+raw.osm3s?.timestamp_osm_base,fetchedAt:new Date().toISOString(),osmBase:raw.osm3s?.timestamp_osm_base,endpoint:'https://overpass-api.de/api/interpreter',source:'OpenStreetMap contributors',license:'ODbL 1.0',bbox:[121.45,24.95,121.67,25.21],query,converterVersion:1,rawElementCount:raw.elements.length,skipped},features};
  validateSnapshot(snapshot);
  const target = new URL('../public/data/park-boundaries-osm.geojson',import.meta.url);
  await writeFile(new URL(target.href+'.tmp'),JSON.stringify(snapshot));
  await rename(new URL(target.href+'.tmp'),target);
  console.log(JSON.stringify({features:features.length,metadata:snapshot.metadata}));
}
