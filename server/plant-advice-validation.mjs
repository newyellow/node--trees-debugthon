export class HttpError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter; }
}
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const only = (v, keys) => object(v) && Object.keys(v).every(k => keys.includes(k));
const string = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
export function validateRequest(v) {
  if (!only(v, ['villageId','mode','message','history','conversationId']) || !string(v.villageId,64) || !/^[A-Za-z0-9_-]+$/.test(v.villageId) || !['planting','home'].includes(v.mode) || !string(v.message,1200) || !Array.isArray(v.history) || v.history.length > 8 || !v.history.every(h => only(h,['role','content']) && ['user','assistant'].includes(h.role) && string(h.content,1200)) || (v.conversationId !== undefined && (typeof v.conversationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v.conversationId)))) throw new HttpError(400,'請檢查里、模式與訊息格式。');
  return {villageId:v.villageId,mode:v.mode,message:v.message,history:v.history.map(({role,content})=>({role,content}))};
}
export function validateModelOutput(v) {
  if (!only(v,['answer','plants','vision']) || !string(v.answer,6000) || typeof v.vision !== 'boolean' || !Array.isArray(v.plants) || v.plants.length > 4 || !v.plants.every(p => only(p,['name','scientificName']) && string(p.name,80) && (p.scientificName === undefined || string(p.scientificName,120)))) throw new HttpError(502,'AI 回覆格式異常，請手動重試。');
  // Never return model-supplied links, markup, images, or executable output.
  if ([v.answer,...v.plants.flatMap(p=>[p.name,p.scientificName || ''])].some(s=> /https?:\/\/|www\.|<[^>]*>|data:|javascript:/i.test(s))) throw new HttpError(502,'AI 回覆格式異常，請手動重試。');
  return {answer:v.answer,plants:v.plants.map(p=>({...p})),vision:v.vision};
}
export function wantsVision(message) { return /願景|未來.*(看看|樣貌|導覽|景象)|四大植群|四區導覽|future vision/i.test(message); }
export function formatResponse(output, input, sources, requestId) {
  const v=validateModelOutput(output);
  return {answer:v.answer,plants:v.plants,sources, ...(input.mode==='planting' && v.vision && wantsVision(input.message) ? {tour:{kind:'four-region-vision'}} : {}), requestId};
}
export function boundedRetryAfter(value) {
  const n=/^\d+$/.test(value || '') ? Number(value) : Math.ceil((Date.parse(value)-Date.now())/1000);
  return Number.isFinite(n) ? Math.max(1,Math.min(3600,n)) : 60;
}
