// Public, repository-owned assets only; never fetch third-party story photos implicitly.
export function validateStoryMedia(entry) {
 if (entry.storyText !== undefined && (!Array.isArray(entry.storyText) || !entry.storyText.length || !entry.storyText.every(p=>typeof p==='string' && p.trim()))) throw Error('Invalid story text');
 if(entry.imageNote!==undefined && (typeof entry.imageNote!=='string' || !entry.imageNote.trim()))throw Error('Invalid missing image note');
 if (entry.images === undefined) return;
 if (!Array.isArray(entry.images)) throw Error('Invalid story images');
 for (const image of entry.images) {
  if (!image || !/^story-media\/[a-z0-9-]+\.(jpg|png|webp)$/.test(image.path) || !['alt','caption','credit','rightsNote'].every(k=>typeof image[k]==='string' && image[k].trim()) || !/^[a-f0-9]{64}$/.test(image.sha256) || !Number.isInteger(image.width) || image.width<1 || !Number.isInteger(image.height) || image.height<1 || !['user-provided','source-attributed'].includes(image.provenance)) throw Error('Invalid story image');
  try {if(new URL(image.sourcePage).protocol!=='https:') throw Error();if(image.provenance==='source-attributed' && (new URL(image.originalImageURL).protocol!=='https:' || image.editorialUse!=='source-article-context')) throw Error();}catch{throw Error('Invalid story image source');}
 }
}
export function appendStoredStoryImages(host,images,base='/') {
 validateStoryMedia({images});
 for(const image of images){
  const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');
  figure.className='story-photo';img.src=base+image.path;img.alt=image.alt;img.width=image.width;img.height=image.height;img.loading='lazy';img.style.width='100%';img.style.height='auto';img.style.maxWidth='100%';
  caption.textContent=image.caption+' · '+image.credit;
  const link=document.createElement('a');link.href=image.sourcePage;link.textContent='照片出處說明';link.rel='noopener noreferrer';caption.append(document.createElement('br'),link);link.title=image.rightsNote;figure.append(img,caption);host.append(figure);
 }
}
