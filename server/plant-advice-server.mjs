import http from 'node:http';
import {isIP} from 'node:net';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {loadGrounding} from './plant-advice-grounding.mjs';
import {createModelClient} from './plant-advice-model.mjs';
import {HttpError,validateRequest,formatResponse} from './plant-advice-validation.mjs';
export const PUBLIC_ORIGIN='https://trees.piyellowclaw.xyz';
const loopback=ip=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);
export function requestIP(req) {const peer=req.socket.remoteAddress;const cf=req.headers['cf-connecting-ip'];return loopback(peer)&&typeof cf==='string'&&isIP(cf) ? cf : peer || 'unknown';}
export function createLimiter({now=Date.now,maxKeys=2048}={}) {
  const ips=new Map();let hour={until:0,count:0},day={until:0,count:0},active=0;
  return {acquire(ip) {
    const t=now();for(const [key,v]of ips)if(v.until<=t)ips.delete(key);
    if(t>=hour.until)hour={until:t+3600000,count:0};if(t>=day.until)day={until:t+86400000,count:0};
    const row=ips.get(ip)||{until:t+600000,count:0};
    const blocked=row.count>=6?row:hour.count>=30?hour:day.count>=120?day:null;
    if(blocked)throw new HttpError(429,'請稍後再試。',Math.max(1,Math.ceil((blocked.until-t)/1000)));
    if(active>=2||(!ips.has(ip)&&ips.size>=maxKeys))throw new HttpError(503,'服務忙碌，請稍後手動重試。',30);
    row.count++;ips.set(ip,row);hour.count++;day.count++;active++;
    let released=false;return ()=>{if(!released){released=true;active--;}};
  },get size(){return ips.size;}};
}
export function validateStaticUpstream(value='http://127.0.0.1:5175') {
  const u=new URL(value);if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname)||!u.port||Number(u.port)===18789||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('Invalid static upstream');return u;
}
function reply(res,status,data,retryAfter) {if(res.destroyed||res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(retryAfter?{'Retry-After':String(retryAfter)}:{})});res.end(JSON.stringify(data));}
async function bodyJSON(req) {
  if(Number(req.headers['content-length'])>16384)throw new HttpError(413,'訊息內容過大。');
  const chunks=[];let size=0;const iterator=req.iterator({destroyOnReturn:false});for await(const chunk of iterator){size+=chunk.length;if(size>16384){req.resume();throw new HttpError(413,'訊息內容過大。');}chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'JSON 格式錯誤。');}
}
function proxyStatic(req,res,upstream) {
  // Only an allowlist of static negotiation headers crosses this boundary.
  const headers={};for(const k of ['accept','accept-encoding','accept-language','if-none-match','if-modified-since','range','if-range'])if(req.headers[k])headers[k]=req.headers[k];
  const upstreamReq=http.request({hostname:upstream.hostname,port:upstream.port,path:req.url,method:req.method,headers},up=>{
    const safe={};for(const k of ['content-type','content-length','content-encoding','cache-control','etag','last-modified','accept-ranges','content-range','vary','x-content-type-options','referrer-policy','content-security-policy'])if(up.headers[k])safe[k]=up.headers[k];
    if(up.headers.location){try{const location=new URL(up.headers.location,upstream);if(location.origin===upstream.origin)safe.location=location.pathname+location.search+location.hash;}catch{ /* malformed redirects are not forwarded */ }}
    res.writeHead(up.statusCode||502,safe);pipeline(up,res).catch(()=>res.destroy());
  });
  upstreamReq.setTimeout(30000,()=>upstreamReq.destroy());upstreamReq.on('error',()=>{if(!res.headersSent)reply(res,502,{error:'靜態頁面暫時無法載入。'});else res.destroy();});res.on('close',()=>upstreamReq.destroy());upstreamReq.end();
}
export function createHandler({grounding,model=createModelClient(),limiter=createLimiter(),staticUpstream='http://127.0.0.1:5175',localOrigin}={}) {
  if(!grounding?.get)throw new Error('Grounding required');const upstream=validateStaticUpstream(staticUpstream);
  const origins=new Set([PUBLIC_ORIGIN]);if(localOrigin){const u=new URL(localOrigin);if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname)||u.origin!==localOrigin)throw new Error('Invalid local staging origin');origins.add(localOrigin);}
  return async(req,res)=>{
    const requestId=randomUUID();let release;const controller=new AbortController();const abort=()=>{if(!res.writableEnded)controller.abort();};req.on('aborted',abort);res.on('close',abort);
    try {
      if(!req.url?.startsWith('/')||req.url.startsWith('//')||req.url.includes('\\'))throw new HttpError(400,'無效路徑。');
      let path;try{path=decodeURIComponent(req.url.split('?')[0]);}catch{throw new HttpError(400,'無效路徑。');}
      if(path.includes('..')||path.includes('\0')||path.includes('\\'))throw new HttpError(400,'無效路徑。');
      if(path==='/api/plant-advice/health'&&req.method==='GET')return reply(res,200,{ok:true});
      if(path==='/api/plant-advice') {
        if(req.method!=='POST')throw new HttpError(405,'僅接受 POST。');
        if(!origins.has(req.headers.origin)||req.headers['sec-fetch-site']==='cross-site')throw new HttpError(403,'僅接受本站請求。');
        if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']||'')||req.headers['content-encoding'])throw new HttpError(400,'僅接受 application/json。');
        const input=validateRequest(await bodyJSON(req));
        release=limiter.acquire(requestIP(req));
        const context=await grounding.get(input.villageId);if(controller.signal.aborted)return;
        const output=await model(input,context,controller.signal);
        return reply(res,200,formatResponse(output,input,grounding.sources,requestId));
      }
      if(path.startsWith('/api')||/^\/(?:v1|ws|gateway)(?:\/|$)/i.test(path))throw new HttpError(404,'找不到此服務。');
      if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'不支援此請求。');
      return proxyStatic(req,res,upstream);
    }catch(error){reply(res,error instanceof HttpError?error.status:503,{error:error instanceof HttpError?error.message:'服務暫時無法使用，請手動重試。',requestId},error instanceof HttpError?error.retryAfter:undefined);}
    finally{release?.();req.off('aborted',abort);if(res.writableEnded)res.off('close',abort);}
  };
}
export async function startServer(options={}) {
  const port=options.port??Number(process.env.PORT||5173);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port');
  const grounding=options.grounding??await loadGrounding({root:process.env.ROOT_DIST||fileURLToPath(new URL('../dist',import.meta.url))});
  const staticUpstream=options.staticUpstream??process.env.STATIC_UPSTREAM??'http://127.0.0.1:5175';
  if(Number(new URL(staticUpstream).port)===port)throw new Error('Static proxy loop');
  const server=http.createServer({maxHeaderSize:8192,requestTimeout:15000,headersTimeout:10000},createHandler({...options,grounding,staticUpstream,localOrigin:options.localOrigin??process.env.ADVICE_LOCAL_ORIGIN}));
  server.maxConnections=64;
  server.on('upgrade',(_req,socket)=>socket.destroy());server.on('connect',(_req,socket)=>socket.destroy());
  await new Promise((yes,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',yes);});return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))startServer().catch(()=>{console.error('Plant advice server startup failed.');process.exitCode=1;});
