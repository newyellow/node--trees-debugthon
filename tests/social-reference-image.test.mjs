import {test} from 'node:test';
import assert from 'node:assert/strict';
import {referenceImage} from '../src/workspaces/02/flora-lookup.js';
test('restricted reference photographs preserve source author and licence without claiming permission',()=>{assert.deepEqual(referenceImage({image_url:'https://example.com/p.jpg',image_source_url:'https://example.com/article',image_license:'all rights reserved',image_attribution:'Author'}),{url:'https://example.com/p.jpg',source:'https://example.com/article',license:'all rights reserved',attribution:'Author'});});
test('reference images reject executable and insecure addresses',()=>{for(const image_url of ['javascript:alert(1)','http://example.com/a.jpg','https://user:pass@example.com/a.jpg','bad',null])assert.equal(referenceImage({image_url}),null);});
test('missing attribution or source remains honest and links actual image',()=>{const x=referenceImage({image_url:'https://example.com/p.jpg',image_source_url:'javascript:alert(1)'});assert.equal(x.source,x.url);assert.equal(x.license,'授權資訊未提供');assert.equal(x.attribution,'作者未提供');});
