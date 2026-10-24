import {compositeRating} from './social-state.js';
export const STAR_BANDS=Object.freeze([
 {stars:0,label:'0.0–0.4 星',color:'#c85645'},
 {stars:1,label:'0.5–1.4 星',color:'#d98228'},
 {stars:2,label:'1.5–2.4 星',color:'#b8a32d'},
 {stars:3,label:'2.5–3.4 星',color:'#3c9874'},
 {stars:4,label:'3.5–4.4 星',color:'#428bbd'},
 {stars:5,label:'4.5–5.0 星',color:'#8b62b4'},
].map(Object.freeze));
export const STAR_UNKNOWN_COLOR='#8b9390';
export const VILLAGE_OPACITY=Object.freeze({base:.48*.8*.7,selected:.70*.8*.7*1.2,hover:.78});
export function starColor(rating){return Number.isFinite(rating)&&rating>=0&&rating<=5?STAR_BANDS[Math.min(5,Math.floor(rating+.5))].color:STAR_UNKNOWN_COLOR;}
export function rankVillages(villages){
 const sorted=villages.map(village=>({village,rating:compositeRating(village.scores)})).sort((a,b)=>{
  if(a.rating!==b.rating)return (b.rating??-1)-(a.rating??-1);
  return String(a.village.id)<String(b.village.id)?-1:String(a.village.id)>String(b.village.id)?1:0;
 });let rank=null;
 return sorted.map((row,index)=>{if(row.rating!==null&&(index===0||row.rating!==sorted[index-1].rating))rank=index+1;return {...row,rank:row.rating===null?null:rank};});
}
