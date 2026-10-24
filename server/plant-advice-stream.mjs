export async function consumeSSE(body, signal, onContent) {
  if(!body?.getReader)throw new Error('Missing stream');
  const reader=body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let bytes=0,buffer='',data=[],finished=false;
  const abort=()=>{void reader.cancel().catch(()=>{});};
  signal.addEventListener('abort',abort,{once:true});
  async function line(value) {
    if(value==='') {
      if(!data.length)return;
      const payload=data.join('\n');data=[];
      if(finished)throw new Error('Data after completion');
      if(payload==='[DONE]'){finished=true;return;}
      const event=JSON.parse(payload);
      if(event.error)throw new Error('Upstream error');
      if(!Array.isArray(event.choices))throw new Error('Invalid event');
      for(const choice of event.choices) {
        if(choice.index!==undefined&&choice.index!==0)throw new Error('Unexpected choice');
        if(choice.finish_reason&&choice.finish_reason!=='stop')throw new Error('Incomplete reply');
        const content=choice.delta?.content;
        if(content!==undefined&&content!==null){if(typeof content!=='string')throw new Error('Invalid delta');await onContent(content);}
      }
    } else if(value.startsWith('data:'))data.push(value.slice(5).replace(/^ /,''));
    else if(value.startsWith('event:')&&value.slice(6).trim()==='error')throw new Error('Upstream error');
  }
  try {
    while(true) {
      if(signal.aborted)throw new Error('Aborted');
      const {value,done}=await reader.read();
      if(signal.aborted)throw new Error('Aborted');
      if(done)break;
      bytes+=value.byteLength;if(bytes>65536)throw new Error('Oversize stream');
      buffer+=decoder.decode(value,{stream:true});
      let match;while((match=/\r\n|\r|\n/.exec(buffer))) {
        if(match[0]==='\r'&&match.index===buffer.length-1)break;
        const value=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);await line(value);if(finished)break;
      }
      if(finished)break;
    }
    if(finished)return;
    buffer+=decoder.decode();
    if(buffer)await line(buffer.replace(/\r$/,''));
    if(data.length)await line('');
    if(!finished)throw new Error('Missing completion');
  } finally {signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});}
}

// Decode only the root answer JSON string; never expose envelope or escape fragments.
// Delay lexical spans until safety checked, including split URL/code prefixes.
export function createAnswerExtractor(onDelta=async()=>{}) {
  let json='',depth=0,rootState='start',key='',inString=false,token='',escape=false,unicode=0,answer=false,decoded='',emitted='',pending='';
  async function flush(final=false) {
    let end=0;
    for(let i=0;i<pending.length;i++)if(/[\s。！？；，、]/u.test(pending[i]))end=i+1;
    if(final)end=pending.length;
    if(!end)return;
    const text=pending.slice(0,end);
    if(/https?:|www\.|<|>|data:|javascript:|\x60|[\[\]{}]/i.test(text))throw new Error('Unsafe answer');
    if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw new Error('Invalid control');
    pending=pending.slice(end);emitted+=text;await onDelta(text);
  }
  async function answerUnit(unit) {
    decoded+=unit;if(decoded.length>6000)throw new Error('Oversize answer');
    let text=decoded.slice(emitted.length+pending.length);
    if(/[\uD800-\uDBFF]$/.test(text))text=text.slice(0,-1);
    if(text){if(!text.isWellFormed())throw new Error('Invalid unicode');pending+=text;await flush();}
  }
  return {
    async push(fragment) {
      json+=fragment;if(Buffer.byteLength(json)>65536)throw new Error('Oversize JSON');
      for(const c of fragment) {
        if(inString) {
          if(unicode){if(!/[0-9a-f]/i.test(c))throw new Error('Invalid escape');token+=c;unicode--;if(!unicode&&answer)await answerUnit(String.fromCharCode(parseInt(token.slice(-4),16)));continue;}
          if(escape){escape=false;token+=c;if(c==='u'){unicode=4;continue;}if(!'"\\/bfnrt'.includes(c))throw new Error('Invalid escape');if(answer)await answerUnit(JSON.parse('"\\'+c+'"'));continue;}
          if(c==='\\'){escape=true;token+=c;continue;}
          if(c==='"') {
            inString=false;
            if(answer){if(!decoded.isWellFormed())throw new Error('Invalid unicode');await flush(true);answer=false;}
            if(depth===1){if(rootState==='key'){key=JSON.parse('"'+token+'"');rootState='colon';}else if(rootState==='value')rootState='after';}
            continue;
          }
          if(c<' ')throw new Error('Invalid string');token+=c;if(answer)await answerUnit(c);continue;
        }
        if(/\s/.test(c))continue;
        if(c==='"'){inString=true;token='';answer=depth===1&&rootState==='value'&&key==='answer';continue;}
        if(c==='{'||c==='['){if(depth===0){if(c!=='{'||rootState!=='start')throw new Error('Invalid root');rootState='key';}depth++;continue;}
        if(c==='}'||c===']'){depth--;if(depth===1&&rootState==='value')rootState='after';continue;}
        if(depth===1&&c===':'){if(rootState!=='colon')throw new Error('Invalid colon');rootState='value';continue;}
        if(depth===1&&c===','){rootState='key';continue;}
      }
    },
    finish(){const result=JSON.parse(json);if(inString||depth!==0||typeof result.answer!=='string'||result.answer!==decoded||emitted!==decoded)throw new Error('Invalid answer');return result;}
  };
}
