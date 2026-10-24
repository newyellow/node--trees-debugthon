import{chromium}from'@playwright/test';import{readFile}from'node:fs/promises';import assert from'node:assert/strict';
const dist=process.env.TEST_DIST||'dist',browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1100,height:800}});await page.route('**/*',r=>r.abort());
 const html=await readFile(dist+'/index.html','utf8'),start=html.indexOf('<section class="homepage"');let hero=html.slice(start,html.indexOf('</section>',start)+10);
 const svg=await readFile(dist+'/assets/kv-typography.svg');hero=hero.replace(/<img class="original-typography"[^>]*>/,'<img class="original-typography" src="data:image/svg+xml;base64,'+svg.toString('base64')+'">');
 await page.setContent('<style>'+await readFile(dist+'/styles.css','utf8')+'</style>'+hero);
 const links=page.locator('.author-links a');assert.equal(await links.count(),3);
 const style=link=>link.evaluate(n=>({color:getComputedStyle(n).color,fill:getComputedStyle(n.querySelector('.author-glyphs path')).fill,underline:getComputedStyle(n.querySelector('.author-underline')).stroke,width:parseFloat(getComputedStyle(n.querySelector('.author-underline')).strokeWidth),dash:getComputedStyle(n.querySelector('.author-underline')).strokeDasharray,boxStroke:getComputedStyle(n.querySelector('rect')).stroke,glyphStroke:getComputedStyle(n.querySelector('.author-glyphs path')).stroke,lineVisibility:getComputedStyle(n.querySelector('.author-underline')).visibility}));
 for(let i=0;i<3;i++){
  const link=links.nth(i),rest=await style(link);assert.equal(rest.color,'rgb(255, 255, 255)');assert.equal(rest.fill,rest.color);assert.equal(rest.underline,rest.color);assert.equal(rest.lineVisibility,'hidden');assert.equal(rest.glyphStroke,'none');assert.equal(rest.boxStroke,'none');
  const glyph=await link.locator('.author-glyphs').boundingBox(),line=await link.locator('.author-underline').boundingBox();assert.ok(line.y>glyph.y+glyph.height-2&&line.width>glyph.width*.9);
  await link.hover();const hover=await style(link);assert.equal(hover.color,'rgb(255, 255, 255)');assert.equal(hover.fill,hover.color);assert.equal(hover.underline,hover.color);assert.equal(hover.lineVisibility,'hidden');assert.equal(hover.glyphStroke,'none');await page.mouse.move(20,20);
 }
 for(let i=0;i<3;i++){await page.keyboard.press('Tab');const link=links.nth(i);assert.equal(await link.evaluate(n=>n===document.activeElement&&n.matches(':focus-visible')),true);const focus=await style(link);assert.equal(focus.fill,'rgb(255, 255, 255)');assert.equal(focus.glyphStroke,'none');assert.equal(focus.lineVisibility,'visible');assert.equal(focus.width,4);assert.notEqual(focus.dash,'none');}
 await page.mouse.move(20,20);await page.locator('body').click({position:{x:20,y:20}});
 if(process.env.AUTHOR_SCREENSHOT)await page.screenshot({path:process.env.AUTHOR_SCREENSHOT,clip:{x:400,y:610,width:650,height:65}});
 console.log(JSON.stringify({links:3,defaultWhiteUnoutlined:true,hoverWhiteNoDecoration:true,keyboardFocusVisible:true,rectangleStroke:'none',viewport:'1100x800',externalNavigation:0,analyticsRequests:0}));
}finally{await browser.close();}
