#!/usr/bin/env python3
"""Verify the compact catalogue against a supplied local DOCX; never publishes it."""
import sys, pathlib, zipfile, xml.etree.ElementTree as ET, json, hashlib
root=pathlib.Path(__file__).resolve().parent.parent
d=json.loads((root/'public/data/mountain-ecology-knowledge.json').read_text())
source=pathlib.Path(sys.argv[1]);raw=source.read_bytes()
assert hashlib.sha256(raw).hexdigest()==d['source']['sha256']
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with zipfile.ZipFile(source) as z:body=ET.fromstring(z.read('word/document.xml')).find('w:body',ns)
paragraphs={};i=0
for e in body:
 if e.tag.endswith('}p'):
  i+=1;paragraphs['p'+str(i).zfill(3)]=''.join(t.text or '' for t in e.findall('.//w:t',ns))
for g in d['groups']:
 text=paragraphs[g['locator']]
 assert hashlib.sha256(text.encode()).hexdigest()==g['paragraphSha256'],g['id']
 assert g['excerpt'] in text,g['id']
 assert all(n in text and n in g['excerpt'] for n in g['names']),g['id']
for c in d['claims']:
 text=paragraphs[c['locator']]
 assert hashlib.sha256(text.encode()).hexdigest()==c['paragraphSha256'],c['id']
 assert c['excerpt'] in text,c['id']
for c in d['ecologicalRelationships']:assert c['excerpt'] in paragraphs[c['locator']]
assert i==91
print('PASS: source hash, 91 paragraphs, all group names/excerpts, claim hashes/excerpts and ecological relationships match DOCX')

