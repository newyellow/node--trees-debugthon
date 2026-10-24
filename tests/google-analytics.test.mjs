import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {googleAnalyticsPlugin,MEASUREMENT_ID,GTAG_SOURCE,GTAG_INITIALIZER} from '../scripts/google-analytics.mjs';
export const entries=['index.html','stories/index.html','stories/research/index.html','explorer/index.html','workspaces/02/index.html','workspaces/03/index.html'];
test('production-only standard snippet preserves dataLayer, sends only js/config and rejects duplicates',()=>{
 const plugin=googleAnalyticsPlugin();assert.equal(plugin.apply,'build');
 const tags=plugin.transformIndexHtml.handler('<html><head></head></html>');assert.equal(tags.length,2);assert.deepEqual(tags[0].attrs,{async:true,src:GTAG_SOURCE});assert.ok(tags.every(t=>t.injectTo==='head-prepend'));
 const dataLayer=['existing-consent-command'],context={window:{dataLayer},dataLayer};runInNewContext(GTAG_INITIALIZER,context);assert.equal(dataLayer[0],'existing-consent-command');assert.equal(dataLayer[1][0],'js');assert.equal(dataLayer[2][0],'config');assert.equal(dataLayer[2][1],MEASUREMENT_ID);assert.equal(dataLayer.length,3);assert.equal(dataLayer[2].length,2);
 assert.throws(()=>plugin.transformIndexHtml.handler('<script src="'+GTAG_SOURCE+'"></script>'),/duplicate/);
});
if(process.env.TEST_DIST)test('every production entry has exactly one async loader/config before head closes',async()=>{
 for(const file of entries){const html=await readFile(process.env.TEST_DIST+'/'+file,'utf8'),head=html.slice(0,html.indexOf('</head>'));assert.equal((html.match(/www\.googletagmanager\.com\/gtag\/js\?id=G-DVFB0184YR/g)||[]).length,1,file);assert.equal((html.match(/gtag\("config", "G-DVFB0184YR"\)/g)||[]).length,1,file);assert.ok(head.includes('async src="'+GTAG_SOURCE+'"'),file);assert.ok(head.includes(GTAG_INITIALIZER),file);}
});
