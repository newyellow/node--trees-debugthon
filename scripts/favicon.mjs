import {posix} from 'node:path';
/** Reuse the radar kit's tree-density pixel tree in every page, including nested bases. */
export function faviconPlugin(){
 let base='/';
 return{name:'shared-site-favicon',configResolved(config){base=config.base;},transformIndexHtml:{order:'post',handler(html,context){
  if(/<link\b[^>]*\brel\s*=\s*["'][^"']*\bicon\b/i.test(html))throw new Error('Favicon already exists; refusing duplicate links');
  const href=file=>base==='./'||base===''?posix.relative(posix.dirname((context.path||'/index.html').replace(/^\//,'')),file):base+file;
  return[
   {tag:'link',attrs:{rel:'icon',type:'image/png',sizes:'32x32',href:href('favicon.png')},injectTo:'head'},
   {tag:'link',attrs:{rel:'icon',type:'image/svg+xml',sizes:'any',href:href('favicon.svg')},injectTo:'head'},
  ];
 }}};
}
