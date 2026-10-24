import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEcology,projectEcology,ECOLOGY_CITATION} from '../server/plant-advice-ecology.mjs';
import {loadGrounding} from '../server/plant-advice-grounding.mjs';
import {createModelClient,SYSTEM_PROMPT} from '../server/plant-advice-model.mjs';
const raw=await readFile(new URL('../public/data/mountain-ecology-knowledge.json',import.meta.url));
const d=parseEcology(raw);
const blueprint=JSON.parse(await readFile(new URL('../public/data/plant-advice-knowledge.json',import.meta.url),'utf8'));
test('catalogue conserves source labels and references without claiming full 249 inventory',()=>{
 assert.equal(d.groups.length,40);assert.equal(d.records.length,365);assert.equal(new Set(d.records.map(r=>r.nameAsPrinted)).size,204);assert.equal(d.claims.length,23);assert.equal(d.ecologicalRelationships.length,3);
 assert.equal(d.summary.fullTaxonInventoryAvailable,false);assert.equal(d.source.author,null);
 for(const g of d.groups){assert.equal(d.records.filter(r=>r.groupId===g.id).length,g.names.length);assert.ok(g.names.every(n=>g.excerpt.includes(n)));}
 assert.equal(d.planCrosswalk.length,20);assert.equal(d.planCrosswalk.filter(x=>x.matchType==='exact-label-only').length,9);
 const ids=new Set(d.records.map(r=>r.id));for(const c of d.planCrosswalk)assert.ok(c.surveyRecordIds.every(id=>ids.has(id)));
 assert.ok(d.issues.some(x=>x.id==='first-total'));assert.ok(d.issues.some(x=>x.id==='origin-conflict'));
 assert.ok(d.groups.find(g=>g.id==='base-new-leaves').periodBasis.includes('推定'));
 assert.equal(d.groups.find(g=>g.id==='hillside-stable-growth').area,'郊山森林間（未細分山系）');
 assert.equal(d.groups.find(g=>g.id==='combined-cultivated').names.filter(n=>n==='朱蕉').length,1);
 const phenology=d.records.filter(r=>['fruiting','sporing','flowering','new-leaves'].includes(r.kind));assert.equal(phenology.length,114);assert.ok(phenology.every(r=>r.period==='2021-02'));
});
test('pinned data fails closed on byte modification',()=>{assert.throws(()=>parseEcology(Buffer.concat([raw,Buffer.from(' ')])));});
test('regional projection keeps named areas, bounded candidate proposals and excludes risky source labels',()=>{
 const n=projectEcology(d,'南港區',blueprint),h=projectEcology(d,'內湖區',blueprint);
 assert.equal(n.relation,'direct-named-mountain-context');assert.equal(h.relation,'interpretive-geographic-context');
 assert.equal(n.selectedVillageSurveyed,false);assert.ok(n.observations.every(x=>x.area==='南港山系'));assert.ok(h.observations.every(x=>x.area==='五指山系南緣'));
 assert.ok(n.candidateReferences.length>10&&n.candidateReferences.length<=20);assert.ok(JSON.stringify(n).length<16000);
 const blocked=new Set(d.recommendationPolicy.excludedFromAutomaticCandidates);
 for(const c of n.candidateReferences){assert.ok(!blocked.has(c.name));assert.equal(c.evidenceType,'source-design-proposal');assert.equal(c.siteSuitabilityVerified,false);assert.ok(c.sourceNotes.every(Boolean));}
 assert.ok(n.candidateReferences.some(c=>c.name==='茄苳'));assert.ok(!n.candidateReferences.some(c=>['烏桕','馬纓丹','馬櫻丹','小花蔓澤蘭'].includes(c.name)));
 for(const district of ['士林區','北投區','大同區','萬華區','中正區','大安區']){const x=projectEcology(d,district,blueprint);assert.equal(x.relation,'not-covered');assert.deepEqual(x.observations,[]);assert.deepEqual(x.candidateReferences,[]);}
 for(const key of ['discord.com','source.docx','paragraphSha256','records','TreeID','coordinates'])assert.ok(!JSON.stringify(n).includes(key));
});
test('actual server grounding supplies new ecology and source citation without live inference',async()=>{
 const g=await loadGrounding({root:new URL('../public',import.meta.url).pathname});assert.ok(g.sources.some(s=>s.url===ECOLOGY_CITATION.url));
 const game=JSON.parse(await readFile(new URL('../public/data/village-game.json',import.meta.url),'utf8'));
 const village=game.villages.find(v=>v.district==='南港區');const context=await g.get(village.id);
 assert.equal(context.ecology.planRegionId,'nangang');assert.equal(context.ecology.selectedVillageSurveyed,false);
 let body;const output={answer:'可以從多樣綠廊開始，讓生活多些樹蔭。',plants:[{name:'茄苳'}],vision:false};
 const frame=JSON.stringify({choices:[{delta:{content:JSON.stringify(output)}}]});
 const nl=String.fromCharCode(10);const model=createModelClient({authLoader:async()=> 'mock-only',fetcher:async(url,opts)=>{body=JSON.parse(opts.body);return new Response('data: '+frame+nl+nl+'data: [DONE]'+nl+nl);}});
 assert.deepEqual(await model({mode:'planting',message:'候選植物',history:[]},context,new AbortController().signal),output);
 const dataMessage=body.messages[1].content;assert.ok(dataMessage.includes('candidateReferences'));assert.ok(dataMessage.includes('茄苳'));assert.ok(dataMessage.includes('selectedVillageSurveyed'));
 assert.ok(SYSTEM_PROMPT.includes('觀測出現不等於建議種植'));assert.ok(SYSTEM_PROMPT.includes('不把此山系清單當居家植物清單'));
});

