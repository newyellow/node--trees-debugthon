import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStoryMedia} from '../src/stories/story-media.js';
import {safeImage} from '../src/workspaces/03/model.js';
const image={path:'story-media/test-article.jpg',width:600,height:400,alt:'原文章中的場景照片',caption:'原文配圖，非選取樹木的現況證據',credit:'原文發布者',rightsNote:'原圖權利歸原權利人，未宣稱開放授權。',sourcePage:'https://example.org/article',originalImageURL:'https://example.org/article-photo.jpg',sha256:'a'.repeat(64),provenance:'source-attributed',editorialUse:'source-article-context'};
test('source-article editorial photos have explicit local-only provenance, not a fake license',()=>{
 assert.doesNotThrow(()=>validateStoryMedia({images:[image]}));
 for(const override of [{provenance:'cc-by'},{editorialUse:'arbitrary-image'},{originalImageURL:'javascript:alert(1)'},{path:'https://example.org/photo.jpg'},{path:'story-media/../../private.jpg'},{rightsNote:''}])assert.throws(()=>validateStoryMedia({images:[{...image,...override}]}));
 for(const key of ['originalImageURL','editorialUse','sourcePage','credit','sha256']){const bad={...image};delete bad[key];assert.throws(()=>validateStoryMedia({images:[bad]}));}
 assert.equal(safeImage({image_url:image.originalImageURL,image_license:'source-attributed',image_source_url:image.sourcePage,image_attribution:image.credit}),null);
});
