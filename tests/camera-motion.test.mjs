import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCameraMotion} from '../src/workspaces/02/camera-motion.js';
function fixture(){
 const handlers=new Map(),host={dataset:{},addEventListener(){},removeEventListener(){}},listeners={};
 const point=(lat,lng)=>({lat,lng,equals:p=>lat===p.lat&&lng===p.lng});
 const map={options:{},_zoomAnimated:true,center:point(25,121),zoom:15,calls:[],getContainer:()=>host,getZoom(){return this.zoom;},getCenter(){return this.center;},getMinZoom:()=>10,getMaxZoom:()=>19,on(events,fn){for(const e of events.split(' ')){if(!handlers.has(e))handlers.set(e,new Set());handlers.get(e).add(fn);}return this;},off(events,fn){for(const e of events.split(' '))handlers.get(e)?.delete(fn);},emit(e){for(const fn of handlers.get(e)||[])fn();},stop(){this.calls.push('stop');},flyTo(center,zoom,options){this.target={center,zoom};this.calls.push({fly:true,options});this.emit('movestart');},setView(center,zoom){this.center=center;this.zoom=zoom;this.calls.push({instant:true});this.emit('moveend');},_getBoundsCenterZoom:(_,o)=>({center:point(26,122),zoom:o.maxZoom})};
 const media={matches:false,addEventListener:(e,fn)=>listeners[e]=fn,removeEventListener:e=>delete listeners[e]};
 return {map,host,media,point,change:()=>listeners.change(),camera:createCameraMotion(map,{host,media})};
}
test('retarget stops old flight; cancel has no delayed refocus',()=>{const {map,camera,point,host}=fixture();camera.run({center:point(26,122),zoom:16});camera.run({center:point(27,123),zoom:17});assert.equal(map.target.center.lat,27);camera.cancel();assert.equal(host.dataset.cameraPhase,'idle');assert.equal(map.calls.filter(c=>c.fly).length,2);});
test('reduced motion settles active destination and live re-enables animation',()=>{const {map,camera,point,media,change}=fixture();camera.run({center:point(26,122),zoom:16});media.matches=true;change();assert.equal(map.zoom,16);assert.equal(map._zoomAnimated,false);media.matches=false;change();assert.equal(map._zoomAnimated,true);camera.run({center:point(27,123),zoom:17});assert.ok(map.calls.at(-1).fly);});
test('no-op is idle and bounds fit preserves exact option-derived zoom',()=>{const {map,camera,host}=fixture();camera.run({center:map.center,zoom:15});assert.equal(host.dataset.cameraPhase,'idle');camera.fit({}, {maxZoom:17.25});assert.equal(map.target.zoom,17.25);});
test('pullback uses current center and clamps at minimum',()=>{const {map,camera,media}=fixture();media.matches=true;map.zoom=10.4;const center=map.center;camera.pullback();assert.equal(map.zoom,10);assert.equal(map.center,center);map.zoom=16.7;camera.pullback();assert.equal(map.zoom,15.45);camera.destroy();});
