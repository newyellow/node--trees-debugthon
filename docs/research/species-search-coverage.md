# 原始標籤搜尋涵蓋進度

由 node scripts/tree-history-coverage.mjs 產生；--check 檢查同步。

471 是來源標籤數，不是分類學物種數；468 個有意義標籤、3 個名稱待核。170 個取得可用搜尋結果；298 個搜尋受阻（75 個僅受阻請求、223 個未逐名請求）。245 個有實際請求，共 320 次。未搜尋／受阻不表示沒有故事；搜尋結果也不等於已查證故事。

JSON：public/data/tree-history-search-coverage.json；CSV：public/data/tree-history-search-coverage.csv（UTF-8 BOM、公式字元防護）。空白名稱保持空白，畫面顯示「未提供名稱」。保留實際請求字串、網址、時間和結果，不公開原始回應。

不從候選故事數推算已確認故事；本表刻意省略故事數。正式故事請查閱獨立的 tree-cultural-stories.json。搜尋進度與故事資料各自載入／重試。無需刷新原始樹木資料。

## 來源釘選 SHA-256

- docs/research/species-inventory.json：43eb9aee566627c3952cd280d6115f1509d30c34163f249e631d36dad9290912
- docs/research/species-round1/research-ledger.json：7740799457d2f58deb658b8f1943198ad862b9c5ae654e6f14aa2d21dfe038ea
- docs/research/species-round1/summary.json：b7e674e4d88b38fb39decbee7c29101560aa8b8b9ec3a77abf87d076fc448ff2
- public/data/street-trees.geojson：a47f844b5122a3f9aac59bb7ae27358d05ea9dd2b24995a4e1d430ac6603a89e
- public/data/park-trees.geojson：3c9c90a9fe947856ca687f78b39c49e9c91aa32967800144866d054038623592
