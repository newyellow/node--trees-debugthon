"""Rebuild the static homepage, preserving all original outlined typography."""

import json
from pathlib import Path
root=Path(__file__).parent
rects=json.loads((root/'public/assets/pixels.json').read_text(encoding='utf-8'))
cells=''.join(f'<rect class="pixel" x="{r["x"]}" y="{r["y"]}" width="{r["w"]}" height="{r["h"]}" fill="{r["c"]}" />' for r in rects)
art='''<svg class="key-visual" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="TAIPEI: 異質性生態城市。A MOSAIC OF URBAN NATURE。TEAM_ 小水滴。MEMBERS_ 洪睿晉 Justin / 黃新 YellowNew / Piyellow / 陳慕天 Swi / 黃馨 Hsin。">
<rect width="1920" height="1080" fill="#95865e"/>
<g class="botanical botanical-one"><image href="%BASE_URL%assets/camphor.png" width="1" height="1" transform="matrix(1341.01028 492.83485 -607.590574 1653.26215 -19.263255 -1292.89117)"/></g>
<g class="botanical botanical-two"><image href="%BASE_URL%assets/camphor.png" width="1" height="1" transform="matrix(1341.01028 492.83485 -607.590574 1653.26215 820.96819 -518.65484)"/></g>
<g class="pixel-field">'''+cells+'''</g>
</svg>
<img class="original-typography" src="%BASE_URL%assets/kv-typography.svg" alt="" aria-hidden="true" width="1920" height="1080">'''
html=(root/'index.template.html').read_text(encoding='utf-8')
(root/'index.html').write_text(html.replace('<!-- HERO_ART -->',art),encoding='utf-8')
print('Built original key visual with fixed outlined typography')
