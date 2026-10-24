# Homepage handoff

Source: Hsin H. taipei-urban-nature-engineer-20261024.zip, authorized by Newyellow 2026-10-24 15:04 Asia/Taipei.

The static homepage replaces only the root entry. Existing applications and explicit index.html routes remain intact.

Edit index.template.html and run python3 build-assets.py before npm run build. The generator was adapted only for repository paths and Vite BASE_URL; it does not modify typography or animation.

public/app.js, public/styles.css, camphor.png, kv-typography.svg, and pixels.json retain the supplied bytes. Typography is outlined SVG: never retype, alter letter spacing, or distort it. Pixel animation uses solid fills and binary visibility; no gradients, fades, or smooth pixel scaling. Botanical animation is part of the supplied design and pauses under reduced-motion/offscreen/hidden states.

Original SHA256:
- kv-typography.svg: 2dbbc2a02526a704276b92613a2251f62e6e9fa1eabe968e0d4445dc6e797cd4
- app.js: fae631f2feded63749521935791948c093d94344866bcea703ec80d5e2e90bab
- styles.css: 0ca08f3d6c132ee13a043416466f782d5211ac566978b2956a4f250aed00bf68

Do not publish Illustrator source, ZIP, previews, or internal handoff documents. Existing static service, backend, Cloudflare route, and public-access semantics are unchanged.

## Entry selection — 2026-10-24 15:17
Newyellow requested only 植物文化地層 (stories/research/index.html, real story database) and 鄰里共生實驗 (workspaces/02/index.html) on the homepage. Explorer/planner are hidden from the homepage, not deleted. Original SVG/CSS/animation bytes remain unchanged.

## Authorized author credit/link correction — 2026-10-24 20:43
Newyellow message1563533267603427489 supersedes the original byte-preservation rule only for the requested English credit and linked names. Exact displayed name is 黃新 Newyellow. Reorder the existing outlined English glyphs, borrowing the identical lowercase y outline from Piyellow, without retyping or loading a font; the other SVG bytes outside this nine-glyph span were compared and remain identical. Chinese names and every other author retain original glyphs/positions.
The authoritative index.template.html adds two native SVG anchors mapped to the same1920×1080 contain coordinates as the original typography image: 黃新 Newyellow→https://newyellow.xyz and 陳慕天 Swi→https://www.facebook.com/RobotAI521. Both have accessible names, tabindex0, target_blank plus noopener noreferrer, and cream hover/focus outlines. build-assets.py corrects the accessible hero credit and regenerates index.html; the original outlined SVG remains the visible asset. CSS and typography URLs receive an author-version query to avoid stale cached bytes. Original source hashes above are historical; the directly affected asset baseline test now pins the authorized assets.
Only new source/generated/built name/href assertions, affected asset baseline, one offline static two-link keyboard/hit-region check and required build651ms. No external personal page fetch/login, GA collect or inference test. The original pixels, animation, other authors, GA, favicon and all application UI remain untouched.
