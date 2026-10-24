// Presentation of an already received answer, not simulated network streaming.
export function textGraphemes(text, Segmenter=globalThis.Intl?.Segmenter) {
  const value=String(text);
  return Segmenter?[...new Segmenter('zh-Hant',{granularity:'grapheme'}).segment(value)].map(s=>s.segment):[value];
}
export function presentText(node,text,{signal,media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  const value=String(text),pieces=textGraphemes(value),stride=Math.max(1,Math.ceil(pieces.length/180));
  return new Promise(resolve=>{
    let timer,offset=0,settled=false;
    const finish=complete=>{if(settled)return;settled=true;clearTimer(timer);signal?.removeEventListener('abort',abort);media?.removeEventListener?.('change',reduced);if(complete)node.textContent=value;resolve(complete);};
    const abort=()=>finish(false),reduced=()=>{if(media.matches)finish(true);};
    const tick=()=>{if(settled)return;offset=Math.min(pieces.length,offset+stride);node.textContent=pieces.slice(0,offset).join('');if(offset===pieces.length)finish(true);else timer=setTimer(tick,30);};
    if(signal?.aborted){finish(false);return;}
    signal?.addEventListener('abort',abort,{once:true});media?.addEventListener?.('change',reduced);
    if(media?.matches||!value){finish(true);return;}tick();
  });
}
