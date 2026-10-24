# Original story image rights audit

2026-10-24T04:31:33.974040+00:00

{'total': 53, 'byStatus': {'displayable': 6, 'source-only': 27, 'unavailable': 0, 'blocked': 3, 'provided-document': 17}, 'uniqueOriginalSourceUrls': 32, 'originalArticleRequests': 32, 'readableOriginalSources': 30, 'blockedOriginalSources': 2, 'licensePolicyRequests': 6, 'verifiedImageUrls': 6, 'articleRequestLimit': 40, 'auditDocument': 'docs/research/social-story-media-audit.md'}

## Method and UI contract

32 unique original URLs fetched once each (40 maximum), paced 1.2 seconds; article body cap 2.5 MB. Six explicitly linked policy pages fetched separately. No broad search, blocked-page bypass, captcha solving or retries. HTTP 429 had no Retry-After; no further requests to that host.
Read source bodies, actual img captions and og:image; accessibility, government domains and metadata do not establish permission. Only explicit government materials grants covering article images, with no third-party credits or separate-permission notices, pass. Third-party exclusions remain binding.
Six original-article 710x470 thumbnails passed licensing review before bounded GET (512 KiB cap), HTTP/content-type/JPEG magic validation. Bytes verified in memory only; no public or local image copies. No generic plant/API substitution.
UI: only displayable may load image.url; show credit, caption, license and linked licenseUrl/sourceUrl together. Remote HTTPS only. On load error fall back to article link, never unaudited og images. source-only/blocked must not load images. provided-document sourceUrl=null means no invented public URL or PDF image permission. Historical claims unchanged.
Raw HTML and parsed bodies remain private in gitignored test-results/social-story-media-audit/. Evidence quotes below are <=100 characters. Absence of permission means not established in this audit, not proof permission can never be obtained.

## Original source ledger

### S00 — HTTP 200
- Source: https://www.taisounds.com/specialtopic/content/194/291501
- Accessed: 2026-10-24T04:27:15.083937+00:00
- IDs: community-fuyuan-second-opinion, community-roosevelt-bischofia
- Review: Original rights quote: 未經授權．不得轉載
- Body SHA-256: e0555dd740c3ff379fc9188bd93f7636d51be65e246020463f429a3f314835dc; truncated: False
- Metadata candidate only, NOT permission: https://cdn.taisounds.com/newsimages/img/2026/0904/20260904160311.jpg

### S01 — HTTP 200
- Source: https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=9648FB336235885C
- Accessed: 2026-10-24T04:27:16.575943+00:00
- IDs: community-gangqian-fengshui
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: de745c5f685a70ac75d896faf895e9376d59b81c850f102e026973e19bf064a1; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/FBsharelogo.jpg

### S02 — HTTP 200
- Source: https://tct.gov.taipei/News_Content.aspx?n=B4C9AF5D5D4BF947&sms=72544237BBE4C5F6&s=57C1A99AB1898B6D
- Accessed: 2026-10-24T04:27:18.601246+00:00
- IDs: community-lions-sakura-family
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: f35ab42af673f864c08ee6916e480820d1676f9bab77eb58a48853e6a89f4f2a; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/297/relpic/10162/4108229/106836e3-d012-46e4-a8d6-3d4d22282b67@710x470.jpg

### S03 — HTTP 200
- Source: https://culture.gov.taipei/News_Content.aspx?n=63F36AA6E434AD08&s=04221DA9959EBB88
- Accessed: 2026-10-24T04:27:20.758698+00:00
- IDs: community-rongjin-preservation
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 084e600ea27d26e0dd80d461f2a0a49edd254bc6a4ce2ddbb9b5358c403408d6; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/FBsharelogo.jpg

### S04 — HTTP 200
- Source: https://wsdo.gov.taipei/News_Content.aspx?n=D4057E6FCFAC77AF&s=4C07F836DF5E13C3
- Accessed: 2026-10-24T04:27:22.992271+00:00
- IDs: community-xingan-temple-banyan
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 1fc5dca0512912567067d354b05b9be00842725db02b2a9d0789193fd8eaf5b3; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/FBsharelogo.jpg

### S05 — HTTP 200
- Source: https://pkl.gov.taipei/News_Content.aspx?n=43E05059FCC72525&s=673A8B2C15249D45
- Accessed: 2026-10-24T04:27:24.435306+00:00
- IDs: community-yangming-et-donation
- Review: Explicit linked government materials grant checked; actual article image/caption has no third-party or separate-permission marking.
- Body SHA-256: e8c30df2d35c08f8458945cf397eb511f6819ebe0efa3afddabfc7b16d24ecd1; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/8110911/a2755cc8-8985-4625-ad46-8cd89ff00bf6@710x470.jpg

### S06 — HTTP 200
- Source: https://vita.tw/%E8%AD%B7%E6%A8%B9%E9%81%8B%E5%8B%95-%E8%AE%93%E6%B0%B8%E5%BA%B7%E7%A4%BE%E5%8D%80%E5%8B%95%E8%B5%B7%E4%BE%86/
- Accessed: 2026-10-24T04:27:25.841788+00:00
- IDs: community-yongkang-preservation
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 662af6b698eb340d05dbc231c5226df42c71742a1f7c02c405b3ee27d1b222e8; truncated: False
- Metadata candidate only, NOT permission: none parsed

### S07 — HTTP 200
- Source: https://www.cksmh.gov.tw/cp.aspx?n=7273
- Accessed: 2026-10-24T04:27:28.639273+00:00
- IDs: inst-cksmh-osmanthus-consolidation
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 0e2a9e5e4dc995d2cef2f747e975243077f12dc148ef8aba7352f2e90f8d4534; truncated: False
- Metadata candidate only, NOT permission: none parsed

### S08 — HTTP 200
- Source: https://ntualumnibm.ntu.edu.tw/bm.bimonthly.article/detail/sn/4462
- Accessed: 2026-10-24T04:27:30.239238+00:00
- IDs: inst-ntu-azalea-donation, inst-ntu-camphor-wave, inst-ntu-fu-phoenix, inst-ntu-juniper-road-widening, inst-ntu-palm-axis
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: d5569451a9d90f2d57ce1e993e76d6d71e7af7ae6aaf227e9b196554a3037d2d; truncated: False
- Metadata candidate only, NOT permission: none parsed

### S09 — HTTP 200
- Source: https://historygallery.ntu.edu.tw/web-ntusym/tree.html
- Accessed: 2026-10-24T04:27:31.871745+00:00
- IDs: inst-ntu-palm-axis
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 32392dbd14b509ed482ad96cb02e96fbffd0d388b92642e5ecbb69b9d894c3af; truncated: False
- Metadata candidate only, NOT permission: none parsed

### S10 — HTTP 200
- Source: https://eyesonplace.net/2022/03/30/20124/
- Accessed: 2026-10-24T04:27:33.150379+00:00
- IDs: inst-renai-palms-retention
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: b79b5ce2c181f1a236d2068fc19f6c3e2377bab5b89aa4b6a1ed27f40e999ecc; truncated: False
- Metadata candidate only, NOT permission: none parsed

### S11 — HTTP 403
- Source: https://www.linking.vision/archives/6977
- Accessed: 2026-10-24T04:27:36.737189+00:00
- IDs: inst-three-lane-uniform-policy, inst-zhongshan-practical-acacia
- Review: No article body obtained; error/checkpoint is not licensing evidence.
- Body SHA-256: not recorded for unsuccessful response; truncated: False
- Metadata candidate only, NOT permission: none parsed

### S12 — HTTP 200
- Source: https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=CFF16DF881820E64
- Accessed: 2026-10-24T04:27:38.064037+00:00
- IDs: inst-zhongshan-diplomatic-avenue
- Review: Explicit linked government materials grant checked; actual article image/caption has no third-party or separate-permission marking.
- Body SHA-256: c34f09e1ecd0d8e1d72fa5e1c26ad4e0ce4561356683afe895e6cd30c67f05f8; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/7589015/20f4103b-1193-4a12-a2cd-be2f30302b3c@710x470.jpg

### S13 — HTTP 200
- Source: https://treesmatch.gov.taipei/pkl/public/tree-map?id=108
- Accessed: 2026-10-24T04:27:39.511689+00:00
- IDs: meilun-presidential-banyans-removal
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 0985cd392b2563f7be15a7d00043532f788191d6baf135921e4b189180cdca6d; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/9720452/46886cea-0d97-4de6-acbe-7940d95f5d3c@710x470.jpg

### S14 — HTTP 200
- Source: https://eculture.gov.taipei/trees/zh-tw/tree/2070
- Accessed: 2026-10-24T04:27:40.900466+00:00
- IDs: cukeng-bischofia-road-preservation
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 993f0e33909918225c648b6cafa074ca5188425b1c35a86ff442c7f342ca9dfc; truncated: False
- Metadata candidate only, NOT permission: none parsed

### S15 — HTTP 200
- Source: https://history.tmu.edu.tw/portfolio-item/%E6%A5%93%E6%9E%97%E9%81%93/
- Accessed: 2026-10-24T04:27:42.498309+00:00
- IDs: tmu-maple-walk-campus-memory
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 62af060e90932e8bb820f6e50222b3d802445508ab6af1cfc741ae19ffdb1cdf; truncated: False
- Metadata candidate only, NOT permission: https://history.tmu.edu.tw/wp-content/uploads/2021/04/rrgr-1.jpg

### S16 — HTTP 429
- Source: https://www.agriharvest.tw/archives/128445/
- Accessed: 2026-10-24T04:27:44.984018+00:00
- IDs: ntu-koelreuteria-road-naming
- Review: No article body obtained; error/checkpoint is not licensing evidence.
- Body SHA-256: not recorded for unsuccessful response; truncated: False
- Metadata candidate only, NOT permission: none parsed

### S17 — HTTP 200
- Source: https://wsdo.gov.taipei/News_Content.aspx?n=D4057E6FCFAC77AF&s=6FC4EE6C0D3BCE66
- Accessed: 2026-10-24T04:27:46.317902+00:00
- IDs: round1-xiaokeng-celtis-shrine
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 6efac23e75b1ef8874c2ca002f16dcd7c7e543e612be884a018a49e598b87438; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/FBsharelogo.jpg

### S18 — HTTP 200
- Source: https://www.cna.com.tw/news/ahel/202204060351.aspx
- Accessed: 2026-10-24T04:27:47.704855+00:00
- IDs: ntu-indian-rosewood-rescue-debate
- Review: Original rights quote: 本網站之文字、圖片及影音，非經授權，不得轉載、公開播送或公開傳輸及利用。
- Body SHA-256: 9687bd68d6a11af16864fc8cca2a0f4e02e892839117c873fd782991f7da9713; truncated: False
- Metadata candidate only, NOT permission: https://imgcdn.cna.com.tw/www/images/pic_fb.jpg

### S19 — HTTP 200
- Source: https://travel.ettoday.net/article/2131139.htm
- Accessed: 2026-10-24T04:27:49.195403+00:00
- IDs: lishan-plaza-cypress-school-memory
- Review: Original rights quote: 本文版權所有，非經授權，不得轉載！
- Body SHA-256: 1509a6f833595964235f8ac0fb916866ea1df329c192441e080afb6e33c8a308; truncated: False
- Metadata candidate only, NOT permission: https://cdn2.ettoday.net/images/6021/e6021065.jpg

### S20 — HTTP 200
- Source: https://wenshan.org.tw/wss/index.php/%E7%94%9F%E6%85%8B/item/2079-%E8%88%88%E9%9A%86%E8%B7%AF%E4%B8%89%E6%AE%B5%E7%9A%84%E7%99%BE%E5%B9%B4%E9%AD%AF%E8%8A%B1%E6%A8%B9%E8%88%87%E5%8F%B0%E5%8C%97%E6%B9%96
- Accessed: 2026-10-24T04:27:50.554890+00:00
- IDs: xinglong-scolopia-community-stele
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 092a1635238f0f73b468e495103108e68063b1a7f1a5c1dd6bcd0da3a69bfd5b; truncated: False
- Metadata candidate only, NOT permission: https://wenshan.org.tw/wss/media/k2/items/cache/825c939ed3e8f5731bfe6f5becd14d5e_XL.jpg

### S21 — HTTP 200
- Source: https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=C97A944E3C88A5D0
- Accessed: 2026-10-24T04:27:52.202024+00:00
- IDs: rongxing-hibiscus-play-care
- Review: Explicit linked government materials grant checked; actual article image/caption has no third-party or separate-permission marking.
- Body SHA-256: d454bbeaa89d1fd13a231c20ca9741aa31037a105f54407275a02a90c1f32471; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/7982307/e5de2a0b-d7f1-40b9-b6ae-218db0d6779a@710x470.jpg

### S22 — HTTP 200
- Source: https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=7E789E8819879CC5
- Accessed: 2026-10-24T04:27:53.633966+00:00
- IDs: beitou-citrus-naming-orchard-memory
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 10435ef9244994b81dcf7efe5184cf5cf74fa927b8822ed33ea3f48ff652c726; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/FBsharelogo.jpg

### S23 — HTTP 200
- Source: https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=26843120BAF90963
- Accessed: 2026-10-24T04:27:55.026120+00:00
- IDs: site-zhongzheng138-mango-early-planting
- Review: Explicit linked government materials grant checked; actual article image/caption has no third-party or separate-permission marking.
- Body SHA-256: 343f7c1e88af63c4e63289c0173c8e7513910b3797fd991def662266dd1dbb92; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/9531097/9491cbf6-8228-45c1-b7f4-4d8a2ed4fd06@710x470.jpg

### S24 — HTTP 200
- Source: https://www.tfri.gov.tw/News_Content.aspx?n=7658&s=262
- Accessed: 2026-10-24T04:27:56.534064+00:00
- IDs: inst-tbg-palmetto-donation-import
- Review: Article invites article reuse, but policy explicitly requires approval for images: 本所發行之影音、圖像與專人著作，需經機關同意方可使用。
- Body SHA-256: 6c33f3539a96a8a0c84acb8ec6a0e9c7eb5830ce0b13b915d37cc2507113903f; truncated: False
- Metadata candidate only, NOT permission: none parsed

### S25 — HTTP 200
- Source: https://www.geo.gov.taipei/News_Content.aspx?n=23285747C0511EC4&sms=72544237BBE4C5F6&s=43EC368CF988933B
- Accessed: 2026-10-24T04:27:58.832285+00:00
- IDs: site-jingshan-grafted-japanese-maple
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: d9feffcddde574bd022c639337a6ae02b1d277c8a8b1b3b6a7c2018578b608e8; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/297/relpic/10162/4080293/fedf0e8b-8598-42a9-ade6-5be2dea99c94@710x470.jpg

### S26 — HTTP 200
- Source: https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=7E23EF226D87E480
- Accessed: 2026-10-24T04:28:00.237687+00:00
- IDs: site-shuanglian-cassia-spacing-2026
- Review: Explicit linked government materials grant checked; actual article image/caption has no third-party or separate-permission marking.
- Body SHA-256: 8cec4147e4a5fb40b9c372a85315f09f4e80f2dc4d121111dd284c802de9690e; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/9726281/a74d7843-4778-4acc-895b-0e0167105c08@710x470.jpg

### S27 — HTTP 200
- Source: https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=208EAE53ED2BFF08
- Accessed: 2026-10-24T04:28:01.620229+00:00
- IDs: site-daan-hundredflowers-loropetalum-design
- Review: Explicit linked government materials grant checked; actual article image/caption has no third-party or separate-permission marking.
- Body SHA-256: 4ef61ab287df1c64f51bc991072f342fe904051b2d9886da68e457f93133e497; truncated: False
- Metadata candidate only, NOT permission: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/8366979/d9aa8b6a-8a2b-4554-85d1-1b5f304017e1@710x470.jpg

### S28 — HTTP 200
- Source: https://ourisland.pts.org.tw/content/8106
- Accessed: 2026-10-24T04:28:03.147680+00:00
- IDs: round1-dalunwei-myrsine-2021
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 36d42000473133a94359d9df391b993c76d6bf5ba9fdc3bae05765c92c602d72; truncated: False
- Metadata candidate only, NOT permission: https://ourisland.pts.org.tw/sites/default/files/field/image/1117%20%2825%29_0.jpg

### S29 — HTTP 200
- Source: https://www.sow.org.tw/blog/20210709/42304
- Accessed: 2026-10-24T04:28:04.806067+00:00
- IDs: round1-dalunwei-myrsine-2021
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 9a2c5bfa7ba669e1d9c139b9ceff1998699cbb34609ea83eaf0195ec55618f20; truncated: False
- Metadata candidate only, NOT permission: https://www.sow.org.tw/sites/default/files/styles/og/public/upload/img/field_weblog_img/fu_tu_er_.jpg?itok=HSRnXs53

### S30 — HTTP 200
- Source: https://vocus.cc/article/63e74f3cfd8978000140015f
- Accessed: 2026-10-24T04:28:07.096610+00:00
- IDs: round1-daan-rubber-family-memory
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: 617f16e3a81d51195a0c1eb2fdb622edeacca47ac93a8989f018889e6e672e37; truncated: False
- Metadata candidate only, NOT permission: https://img.vocus.cc/cX5S1X4B6g-kWxkbUiSL2n7nF4wMGFxXobSHqP-jsd8/w:1200/f:jpg/plain/https://images.vocus.cc/0dc09351-6b99-4090-8b95-a843046fc05a.jpg

### S31 — HTTP 200
- Source: https://news.pts.org.tw/article/198873
- Accessed: 2026-10-24T04:28:08.750911+00:00
- IDs: round1-neihu-citrus-leisure-2011
- Review: No image reuse grant established in retrieved article.
- Body SHA-256: f873b4b4b41e36148ec81eee0637095282e8c0be3e5eeaf019218e827f5d8299; truncated: False
- Metadata candidate only, NOT permission: https://news.pts.org.tw/images/ptsnews-banner.jpg

## Policy ledger

- https://www.gov.taipei/News_Content.aspx?n=10FDEA7683714512&sms=AA987E1C50412097&s=3B6C92FD22C01611
  - 2026-10-24T04:28:44.470872+00:00; HTTP 200.
  - Evidence quote: 其得受著作權保護之範圍，以無償、非專屬、得再授權之方式提供公眾使用
  - Scope quote: 網站上刊載之所有資料與素材
  - Use quote: 重製、改作、編輯、公開傳輸或為其他方式之利用
  - Attribution required. Excludes logos/trademarks and specially marked materials requiring permission; policy expressly mentions some third-party audiovisual/image works. Not a CC license and not inferred from domain.
- https://culture.gov.taipei/cp.aspx?n=F8CBB1FA607C0808
  - 2026-10-24T04:28:45.828441+00:00; HTTP 200.
  - Evidence quote: 其得受著作權保護之範圍，以無償、非專屬、得再授權之方式提供公眾使用
  - Scope quote: 網站上刊載之所有資料與素材
  - Use quote: 重製、改作、編輯、公開傳輸或為其他方式之利用
  - Attribution required. Excludes logos/trademarks and specially marked materials requiring permission; policy expressly mentions some third-party audiovisual/image works. Not a CC license and not inferred from domain.
- https://pkl.gov.taipei/News_Content.aspx?n=E6C86666B7A86451&sms=9E2FE7F26B57E721&s=40CFBA6200D34643
  - 2026-10-24T04:28:48.201542+00:00; HTTP 200.
  - Evidence quote: 其得受著作權保護之範圍，以無償、非專屬、得再授權之方式提供公眾使用
  - Scope quote: 網站上刊載之所有資料與素材
  - Use quote: 重製、改作、編輯、公開傳輸或為其他方式之利用
  - Attribution required. Excludes logos/trademarks and specially marked materials requiring permission; policy expressly mentions some third-party audiovisual/image works. Not a CC license and not inferred from domain.
- https://www.cksmh.gov.tw/cp.aspx?n=6263
  - 2026-10-24T04:28:49.639830+00:00; HTTP 200.
  - Refers to separately licensed datasets on government open-data platform; no article image grant established.
- https://www.tfri.gov.tw/cp.aspx?n=7602
  - 2026-10-24T04:28:51.285828+00:00; HTTP 200.
  - Exclusion quote: 本所發行之影音、圖像與專人著作，需經機關同意方可使用。
- https://www.geo.gov.taipei/News_Content.aspx?Create=1&n=30600B1C31EC57DE&state=F5D336F102ACBC68&s=93535E43C1E4B4EC&sms=D586B2F954D62925
  - 2026-10-24T04:28:53.608884+00:00; HTTP 200.
  - Retrieved infringement process and footer restriction: 請勿任意轉載作商業用途. No clear open-image grant established.

## Displayable images — exact metadata and evidence

Credit is publishing agency, not an invented photographer. Original caption retained; does not imply a photograph dates from historical event.

### community-yangming-et-donation
- url: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/8110911/a2755cc8-8985-4625-ad46-8cd89ff00bf6@710x470.jpg
- sourceUrl: https://pkl.gov.taipei/News_Content.aspx?n=43E05059FCC72525&s=673A8B2C15249D45
- license: 臺北市政府網站資料開放宣告（註明出處；排除另行聲明素材）
- licenseUrl: https://pkl.gov.taipei/News_Content.aspx?n=E6C86666B7A86451&sms=9E2FE7F26B57E721&s=40CFBA6200D34643
- credit: 臺北市政府工務局公園路燈工程管理處
- caption: 圖1：迎接櫻花的來到，世界及全臺各地的百萬遊客如鮭魚返鄉般，絡繹不絕。
- evidenceQuote: 其得受著作權保護之範圍，以無償、非專屬、得再授權之方式提供公眾使用
- Third-party check: no third-party image credit or separate-permission notice found in actual article body/caption. Actual attached image is associated with story site/event, not generic species photo.
- Verified 2026-10-24T04:29:28.908069+00:00: HTTP 200; image/jpeg; 45768 bytes; JPEG magic; SHA-256 26dfc75c770d685b4fe8b1f464c49959ae8911c7ea6cd5a5be8c632a650b8819.

### inst-zhongshan-diplomatic-avenue
- url: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/7589015/20f4103b-1193-4a12-a2cd-be2f30302b3c@710x470.jpg
- sourceUrl: https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=CFF16DF881820E64
- license: 臺北市政府網站資料開放宣告（註明出處；排除另行聲明素材）
- licenseUrl: https://www.gov.taipei/News_Content.aspx?n=10FDEA7683714512&sms=AA987E1C50412097&s=3B6C92FD22C01611
- credit: 臺北市政府工務局公園路燈工程管理處
- caption: 圖1.日治時期的敕使街道(今中山北路)是通往神社(現址圓山飯店)參拜的道路；楓紅的四季變化在塵囂的都市裡也感受的到。
- evidenceQuote: 其得受著作權保護之範圍，以無償、非專屬、得再授權之方式提供公眾使用
- Third-party check: no third-party image credit or separate-permission notice found in actual article body/caption. Actual attached image is associated with story site/event, not generic species photo.
- Verified 2026-10-24T04:29:30.222016+00:00: HTTP 200; image/jpeg; 68229 bytes; JPEG magic; SHA-256 71cd4d4c025fdb8d3f604227b64ff4a74e56d0b781afcedf49d95bafa73bb12d.

### rongxing-hibiscus-play-care
- url: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/7982307/e5de2a0b-d7f1-40b9-b6ae-218db0d6779a@710x470.jpg
- sourceUrl: https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=C97A944E3C88A5D0
- license: 臺北市政府網站資料開放宣告（註明出處；排除另行聲明素材）
- licenseUrl: https://www.gov.taipei/News_Content.aspx?n=10FDEA7683714512&sms=AA987E1C50412097&s=3B6C92FD22C01611
- credit: 臺北市政府工務局公園路燈工程管理處
- caption: 圖1.位在榮星花園公園的黃槿樹，他的樹葉大而茂密，非常適合乘涼.JPG
- evidenceQuote: 其得受著作權保護之範圍，以無償、非專屬、得再授權之方式提供公眾使用
- Third-party check: no third-party image credit or separate-permission notice found in actual article body/caption. Actual attached image is associated with story site/event, not generic species photo.
- Verified 2026-10-24T04:29:31.519700+00:00: HTTP 200; image/jpeg; 81713 bytes; JPEG magic; SHA-256 da4d5bf86089cf0daa54948455fa9b62984cc675434004185e97a126fd442ae1.

### site-zhongzheng138-mango-early-planting
- url: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/9531097/9491cbf6-8228-45c1-b7f4-4d8a2ed4fd06@710x470.jpg
- sourceUrl: https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=26843120BAF90963
- license: 臺北市政府網站資料開放宣告（註明出處；排除另行聲明素材）
- licenseUrl: https://www.gov.taipei/News_Content.aspx?n=10FDEA7683714512&sms=AA987E1C50412097&s=3B6C92FD22C01611
- credit: 臺北市政府工務局公園路燈工程管理處
- caption: (圖1) 中正138號綠地串聯舊城外植物園、城中商圈、機關古蹟群等觀光場所，值得連假來散步、小旅行。
- evidenceQuote: 其得受著作權保護之範圍，以無償、非專屬、得再授權之方式提供公眾使用
- Third-party check: no third-party image credit or separate-permission notice found in actual article body/caption. Actual attached image is associated with story site/event, not generic species photo.
- Verified 2026-10-24T04:29:32.803592+00:00: HTTP 200; image/jpeg; 93338 bytes; JPEG magic; SHA-256 7eca9dadc41a410d66ff6e043da1b617aa1f29ce3c2720c66894654cc9be583e.

### site-shuanglian-cassia-spacing-2026
- url: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/9726281/a74d7843-4778-4acc-895b-0e0167105c08@710x470.jpg
- sourceUrl: https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=7E23EF226D87E480
- license: 臺北市政府網站資料開放宣告（註明出處；排除另行聲明素材）
- licenseUrl: https://www.gov.taipei/News_Content.aspx?n=10FDEA7683714512&sms=AA987E1C50412097&s=3B6C92FD22C01611
- credit: 臺北市政府工務局公園路燈工程管理處
- caption: 雙連捷運站線型公園種樹
- evidenceQuote: 其得受著作權保護之範圍，以無償、非專屬、得再授權之方式提供公眾使用
- Third-party check: no third-party image credit or separate-permission notice found in actual article body/caption. Actual attached image is associated with story site/event, not generic species photo.
- Verified 2026-10-24T04:29:34.094297+00:00: HTTP 200; image/jpeg; 65896 bytes; JPEG magic; SHA-256 4e5e7b553c8e85faf77a816aa593c47966f34849a7e1e6c3d6c13f89522ebe69.

### site-daan-hundredflowers-loropetalum-design
- url: https://www-ws.gov.taipei/001/Upload/348/relpic/10162/8366979/d9aa8b6a-8a2b-4554-85d1-1b5f304017e1@710x470.jpg
- sourceUrl: https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=208EAE53ED2BFF08
- license: 臺北市政府網站資料開放宣告（註明出處；排除另行聲明素材）
- licenseUrl: https://www.gov.taipei/News_Content.aspx?n=10FDEA7683714512&sms=AA987E1C50412097&s=3B6C92FD22C01611
- credit: 臺北市政府工務局公園路燈工程管理處
- caption: 小造景也是很好的拍照打卡地點.JPG
- evidenceQuote: 其得受著作權保護之範圍，以無償、非專屬、得再授權之方式提供公眾使用
- Third-party check: no third-party image credit or separate-permission notice found in actual article body/caption. Actual attached image is associated with story site/event, not generic species photo.
- Verified 2026-10-24T04:29:35.353283+00:00: HTTP 200; image/jpeg; 59504 bytes; JPEG magic; SHA-256 ad5353d8a3058085db9e857f38e0081b8cea761ed9d673977dc40dab8d255500.

## Complete story coverage

| Story ID | Status | Source |
|---|---|---|
| community-fuyuan-second-opinion | source-only | https://www.taisounds.com/specialtopic/content/194/291501 |
| community-gangqian-fengshui | source-only | https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=9648FB336235885C |
| community-lions-sakura-family | source-only | https://tct.gov.taipei/News_Content.aspx?n=B4C9AF5D5D4BF947&sms=72544237BBE4C5F6&s=57C1A99AB1898B6D |
| community-rongjin-preservation | source-only | https://culture.gov.taipei/News_Content.aspx?n=63F36AA6E434AD08&s=04221DA9959EBB88 |
| community-roosevelt-bischofia | source-only | https://www.taisounds.com/specialtopic/content/194/291501 |
| community-xingan-temple-banyan | source-only | https://wsdo.gov.taipei/News_Content.aspx?n=D4057E6FCFAC77AF&s=4C07F836DF5E13C3 |
| community-yangming-et-donation | displayable | https://pkl.gov.taipei/News_Content.aspx?n=43E05059FCC72525&s=673A8B2C15249D45 |
| community-yongkang-preservation | source-only | https://vita.tw/%E8%AD%B7%E6%A8%B9%E9%81%8B%E5%8B%95-%E8%AE%93%E6%B0%B8%E5%BA%B7%E7%A4%BE%E5%8D%80%E5%8B%95%E8%B5%B7%E4%BE%86/ |
| inst-cksmh-osmanthus-consolidation | source-only | https://www.cksmh.gov.tw/cp.aspx?n=7273 |
| inst-ntu-azalea-donation | source-only | https://ntualumnibm.ntu.edu.tw/bm.bimonthly.article/detail/sn/4462 |
| inst-ntu-camphor-wave | source-only | https://ntualumnibm.ntu.edu.tw/bm.bimonthly.article/detail/sn/4462 |
| inst-ntu-fu-phoenix | source-only | https://ntualumnibm.ntu.edu.tw/bm.bimonthly.article/detail/sn/4462 |
| inst-ntu-juniper-road-widening | source-only | https://ntualumnibm.ntu.edu.tw/bm.bimonthly.article/detail/sn/4462 |
| inst-ntu-palm-axis | source-only | https://historygallery.ntu.edu.tw/web-ntusym/tree.html |
| inst-renai-palms-retention | source-only | https://eyesonplace.net/2022/03/30/20124/ |
| inst-three-lane-uniform-policy | blocked | https://www.linking.vision/archives/6977 |
| inst-zhongshan-diplomatic-avenue | displayable | https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=CFF16DF881820E64 |
| inst-zhongshan-practical-acacia | blocked | https://www.linking.vision/archives/6977 |
| meilun-presidential-banyans-removal | source-only | https://treesmatch.gov.taipei/pkl/public/tree-map?id=108 |
| cukeng-bischofia-road-preservation | source-only | https://eculture.gov.taipei/trees/zh-tw/tree/2070 |
| tmu-maple-walk-campus-memory | source-only | https://history.tmu.edu.tw/portfolio-item/%E6%A5%93%E6%9E%97%E9%81%93/ |
| ntu-koelreuteria-road-naming | blocked | https://www.agriharvest.tw/archives/128445/ |
| round1-xiaokeng-celtis-shrine | source-only | https://wsdo.gov.taipei/News_Content.aspx?n=D4057E6FCFAC77AF&s=6FC4EE6C0D3BCE66 |
| ntu-indian-rosewood-rescue-debate | source-only | https://www.cna.com.tw/news/ahel/202204060351.aspx |
| lishan-plaza-cypress-school-memory | source-only | https://travel.ettoday.net/article/2131139.htm |
| xinglong-scolopia-community-stele | source-only | https://wenshan.org.tw/wss/index.php/%E7%94%9F%E6%85%8B/item/2079-%E8%88%88%E9%9A%86%E8%B7%AF%E4%B8%89%E6%AE%B5%E7%9A%84%E7%99%BE%E5%B9%B4%E9%AD%AF%E8%8A%B1%E6%A8%B9%E8%88%87%E5%8F%B0%E5%8C%97%E6%B9%96 |
| rongxing-hibiscus-play-care | displayable | https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=C97A944E3C88A5D0 |
| beitou-citrus-naming-orchard-memory | source-only | https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=7E789E8819879CC5 |
| site-zhongzheng138-mango-early-planting | displayable | https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=26843120BAF90963 |
| inst-tbg-palmetto-donation-import | source-only | https://www.tfri.gov.tw/News_Content.aspx?n=7658&s=262 |
| site-jingshan-grafted-japanese-maple | source-only | https://www.geo.gov.taipei/News_Content.aspx?n=23285747C0511EC4&sms=72544237BBE4C5F6&s=43EC368CF988933B |
| site-shuanglian-cassia-spacing-2026 | displayable | https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=7E23EF226D87E480 |
| site-daan-hundredflowers-loropetalum-design | displayable | https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=208EAE53ED2BFF08 |
| round1-dalunwei-myrsine-2021 | source-only | https://ourisland.pts.org.tw/content/8106 |
| round1-daan-rubber-family-memory | source-only | https://vocus.cc/article/63e74f3cfd8978000140015f |
| round1-neihu-citrus-leisure-2011 | source-only | https://news.pts.org.tw/article/198873 |
| yuanshan-pollen-oak | provided-document | provided-document: not public image permission |
| yuanshan-pollen-castanopsis | provided-document | provided-document: not public image permission |
| yuanshan-machilus | provided-document | provided-document: not public image permission |
| yuanshan-camphor-prehistory | provided-document | provided-document: not public image permission |
| yuanshan-ficus-prehistory | provided-document | provided-document: not public image permission |
| yuanshan-barringtonia-lagoon | provided-document | provided-document: not public image permission |
| yuanshan-cephalanthus-lagoon | provided-document | provided-document: not public image permission |
| yuanshan-dalongdong-banyan | provided-document | provided-document: not public image permission |
| yuanshan-dalongdong-acacia | provided-document | provided-document: not public image permission |
| yuanshan-park-cherry | provided-document | provided-document: not public image permission |
| yuanshan-park-camphor | provided-document | provided-document: not public image permission |
| yuanshan-park-pine | provided-document | provided-document: not public image permission |
| yuanshan-park-cedar | provided-document | provided-document: not public image permission |
| yuanshan-shrine-forest | provided-document | provided-document: not public image permission |
| yuanshan-palm-introduction | provided-document | provided-document: not public image permission |
| yuanshan-avenue-banyan-removal | provided-document | provided-document: not public image permission |
| yuanshan-expo-barringtonia | provided-document | provided-document: not public image permission |
