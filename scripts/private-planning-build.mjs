import{rm}from'node:fs/promises';import{resolve}from'node:path';
export const PRIVATE_PLANNING_FILES=Object.freeze(['plant-advice-knowledge.json','mountain-ecology-knowledge.json','street-tree-planning-knowledge.json']);
/** Keep backend/planning inputs in source, never in static publication output. */
export function privatePlanningBuildPlugin(){let output;return{name:'exclude-raw-planning-json',apply:'build',configResolved(config){output=resolve(config.root,config.build.outDir);},async closeBundle(){if(!output)throw Error('Missing build output');for(const file of PRIVATE_PLANNING_FILES)await rm(resolve(output,'data',file),{force:true});}};}
