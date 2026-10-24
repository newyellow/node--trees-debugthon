/** Consume actual server chunks, not a post-response typing animation. */
export async function readAdviceStream(response,{signal,onDelta=()=>{}}={}) {
  if(!/application\/x-ndjson/i.test(response.headers?.get('Content-Type')||''))return response.json();
  const reader=response.body?.getReader();if(!reader)throw Error('Missing response body');
  const abort=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
  const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,buffer='',answer='',result;
  const consume=line=>{if(!line.trim())return;if(result)throw Error('Event after completion');const event=JSON.parse(line);
    if(event.type==='error')throw Error('AI stream failed');
    if(event.type==='delta'){if(typeof event.text!=='string'||!event.text||answer.length+event.text.length>6000)throw Error('Invalid delta');answer+=event.text;onDelta(event.text);}
    else if(event.type==='done'){const value=event.result||event;if(typeof value.answer!=='string'||value.answer!==answer)throw Error('Inconsistent completed answer');result=value;}
    else throw Error('Invalid stream event');};
  try{while(true){if(signal?.aborted)throw Error('Aborted');const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>131072)throw Error('Oversize stream');buffer+=decoder.decode(value,{stream:true});let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);consume(line);}if(buffer.length>65536)throw Error('Oversize event');}buffer+=decoder.decode();if(buffer.trim())consume(buffer);if(!result)throw Error('Incomplete stream');return result;
  }finally{signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});}
}
