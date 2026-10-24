import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateStoryMedia} from '../src/stories/story-media.js';
import {filterEntries,validateResearchData} from '../src/stories/research-model.js';
import {queryStories} from '../src/workspaces/02/story-query.js';
import {toCsv,toMarkdown} from '../scripts/tree-history-data.mjs';
const data=validateResearchData(JSON.parse(await readFile(new URL('../public/data/tree-cultural-stories.json',import.meta.url))));
const e=data.entries.find(e=>e.id==='royal-palm-southern-imagination');
test('royal palm exact species association and stored photo survive both story consumers',async()=>{
 assert.deepEqual(e.species,['大王椰子']);assert.ok(filterEntries(data.entries,{species:'大王椰子'}).includes(e));
 assert.ok(queryStories(data,{species:'大王椰子',district:'北投區',village:'大屯里'}).general.includes(e));
 assert.ok(!Object.values(queryStories(data,{species:'亞歷山大椰子'})).some(v=>Array.isArray(v)&&v.includes(e)));
 assert.equal(e.sources.length,2);assert.equal(e.storyText.length,6);
 const b=await readFile(new URL('../public/'+e.images[0].path,import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),e.images[0].sha256);
 assert.equal(b[0],255);assert.equal(b[1],216);assert.ok(toCsv(data).includes(e.images[0].path));assert.ok(toMarkdown(data).includes(e.images[0].path));
});
test('stored story images reject unsafe paths and require provenance rather than fake open license',()=>{
 for(const path of ['https://example.com/a.jpg','../secret.jpg','story-media/../secret.jpg','story-media/evil.svg','javascript:alert(1)'])assert.throws(()=>validateStoryMedia({images:[{...e.images[0],path}]}));
 for(const field of ['sha256','credit','rightsNote','provenance','alt']){const bad={...e.images[0]};delete bad[field];assert.throws(()=>validateStoryMedia({images:[bad]}));}
 assert.throws(()=>validateStoryMedia({images:[{...e.images[0],sourcePage:'javascript:alert(1)'}]}));
});
