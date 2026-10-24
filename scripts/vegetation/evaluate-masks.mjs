#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {evaluatePilot} from '../../src/vegetation/evaluation.js';
const args=process.argv.slice(2);
if(args.length===1&&['--help','-h'].includes(args[0])) {
 console.log('Usage: node scripts/vegetation/evaluate-masks.mjs LOCAL_MANIFEST.json\nSee docs/research/imagery-algorithms/evaluation-protocol.md. JSON stdout only; no downloads or model selection.');
}else{
 try{
  if(args.length!==1||args[0].includes('://'))throw Error('one local JSON manifest path required; use --help');
  const bytes=await readFile(args[0]);
  console.log(JSON.stringify({inputSha256:createHash('sha256').update(bytes).digest('hex'),...evaluatePilot(JSON.parse(bytes))},null,2));
 }catch(error){console.error('Evaluation failed: '+error.message);process.exitCode=1;}
}
