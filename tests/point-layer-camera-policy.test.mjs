import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../src/point-layers.js',import.meta.url),'utf8')).split('\n').filter(l=>!l.startsWith('import ')).join('\n').replace('export function','function');
function scenario(options={},count=2){
 let marker,fit=0;
 const make=()=>marker={events:{},bindTooltip(){return this;},on(k,f){this.events[k]=f;return this;},bindPopup(content,opts){this.popup={content,opts};return this;},openPopup(){this.open=true;return this;}};
 const L={marker:make,circleMarker:make,divIcon:v=>v};
 const document={createElement:()=>({children:[],append(...nodes){this.children.push(...nodes);}})};
 const render=new Function('L','RBush','matches','gridGroups','unionBounds','document',source+';return renderPointLayer;')(L,null,()=>true,null,()=>[1,2,3,4],document);
 const group={key:'g',lat:25,lng:121,features:Array.from({length:count},(_,i)=>({properties:{_name:'tree',TreeID:String(i)}}))};
 render({definition:{id:'protected-trees',kind:'point',color:'#123456'},dataset:{groupCache:{version:JSON.stringify([16,56,'','',null]),index:{search:()=>[{group}]}}},state:{district:'',query:'',opacity:new Map()},map:{getZoom:()=>16,latLngToContainerPoint:()=>({y:300})},bounds:{getWest:()=>0,getEast:()=>1,getSouth:()=>0,getNorth:()=>1},scene:{use:(_k,_v,create)=>create()},featurePopup:()=>document.createElement('section'),fitBounds:()=>fit++,...options});
 if(count>1)marker.events.click();return{marker,fit};
}
test('default clusters retain explicit zoom intent; opted tree records preserve camera and constrain popup height',()=>{
 const old=scenario();assert.equal(old.fit,1);assert.equal(old.marker.open,undefined);
 const tree=scenario({clusterZoom:false,popupOptions:{autoPan:false}});assert.equal(tree.fit,0);assert.equal(tree.marker.open,true);assert.equal(tree.marker.popup.opts.autoPan,false);assert.equal(tree.marker.popup.opts.maxHeight,190);
 const single=scenario({popupOptions:{autoPan:false}},1);assert.equal(single.marker.popup.opts.autoPan,false);assert.equal(single.marker.popup.opts.maxHeight,190);assert.equal(single.fit,0);
});
