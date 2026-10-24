import {speciesName,speciesColor,UNKNOWN_SPECIES} from '../../species.js';
// TreeType is the original source label, not a taxonomically reconciled species.
export const treeSpecies = feature => speciesName(feature.properties.TreeType);
export const treeSpeciesColor = feature => speciesColor(treeSpecies(feature));
export function speciesEntries(features) {
 const counts=new Map();for(const f of features){const name=treeSpecies(f);counts.set(name,(counts.get(name)||0)+1);}
 return [...counts].map(([name,count])=>({name,count,color:speciesColor(name)})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh-TW'));
}
export function updateSpeciesLegend(host,features) {
 host.replaceChildren();host.hidden=!features.length;if(!features.length)return;
 const entries=speciesEntries(features),heading=document.createElement('strong');heading.textContent='樹木來源名稱圖例（'+entries.length+' 類）';host.append(heading);
 const note=document.createElement('small');note.textContent='依 TreeType 正規化；跨行道／公園同名同色，非分類學鑑定。'+UNKNOWN_SPECIES+'、枯木為灰色；混合名稱群集為灰藍。';host.append(note);
 const row=entry=>{const li=document.createElement('li'),swatch=document.createElement('span');swatch.style.background=entry.color;swatch.setAttribute('aria-hidden','true');li.dataset.species=entry.name;li.dataset.color=entry.color;li.append(swatch,document.createTextNode(entry.name+' · '+entry.count+' 筆'));return li;};
 const list=document.createElement('ul');entries.slice(0,8).forEach(e=>list.append(row(e)));host.append(list);
 if(entries.length>8){const details=document.createElement('details'),summary=document.createElement('summary'),rest=document.createElement('ul');summary.textContent='展開其餘 '+(entries.length-8)+' 類';entries.slice(8).forEach(e=>rest.append(row(e)));details.append(summary,rest);host.append(details);}
}
