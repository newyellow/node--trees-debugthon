# 原生植栽規劃室（workspace 03）

入口：`workspaces/03/index.html`。2026-10-24 改為直接呈現照片植物卡，不再提供主要搜尋表單。

## 自動清單

- 首次載入自動 GET recommend?limit=12&has_image=true；尚未選點明示預覽。行政區、地圖點位＋海拔完成、場景、手動日照／量測水分／海拔變更後 debounce 650ms。等待海拔期間不發植物查詢；失敗後不自動重試，僅小型更新／重試按鈕。
- 單一 in-flight、AbortController、版本 stale guard、12s timeout、24項 session cache；429 Retry-After（秒／日期，缺少至少60秒）冷卻。草稿、照片、樹穴、澆水頻率與維護紀錄不觸發 API。
- 不預選形態、不送 q、日照、水分、澆水頻率或樹穴；海拔有效才送。日照／水分混語採本機三態比較。每次只有12筆樣本，不是完整名錄，海拔 server filter 可能排除未知。
- 主清單只列沒有明確矛盾者；已知相同條件數優先，再依學名／UUID穩定排序，不產生分數。未知仍待覆核，不代表適合或已確認原生。Lantana 身分警告與條件不符者保留折疊排除區，禁止加草稿。
- 照片頂置，中文／學名／形態與小型條件標記；raw facts、未知、原生警告、來源與署名收在卡片 disclosure。不轉載 description；不複製參考網站 prose 或原生數量宣稱。

## 影像與隱私

safeImage 規則不放寬：explicit CC0，或 CC BY/BY-SA 且有署名、獨立 HTTPS來源頁才展示；NC/ND/PD/unknown隱藏。HTTPS禁帳密、no-referrer、署名textContent。metadata不是獨立權利認證，正式重用仍需逐圖核對。缺合規照片／載入錯誤提供真正空位，不用假植物照。現地照片選填，12MB以下JPEG/PNG/WebP，僅blob預覽；換圖／清除／重設／pagehide revoke，不讀bytes、不上傳、不AI、不持久化。

## 場地、草稿與限制

行政界線來自 data/regions.json 的 districts，按需載入；無樹木資料。政策陽明／內湖／南港／河濱分組不是植物區系；四河與社子只由使用者指定，不造假幾何。地圖選點才透過 parent-owned site-environment.js GET Open-Meteo 海拔；loading清舊值、無值仍未知、有效0保留，版本取消避免stale。不宣稱海拔為現場、建物或陽台高度。

室外／陽台／室內日照為明示假設，進階可覆寫未知、跨點位與場景保留。澆水頻率不轉土壤水分。草稿僅頁面記憶體、手動加入移除與形態分組；已知一致非相容保證。不提供根域／密度／株數／株距／安全判定。缺田尾供應商／聯絡／庫存／報價，不捏造。

## 驗證

`node --test tests/native-planner.test.mjs`
`node scripts/check-native-planner-browser.mjs`
`node scripts/check-native-planner-browser.mjs --real`

瀏覽器使用現有Chrome；NATIVE_PLANNER_URL可覆寫5193。mock涵蓋初始自動、無主要搜尋、地圖等海拔、rapid debounce/stale、照片卡與缺圖、無照片加草稿、local資料零額外API、503手動重試／empty／429無循環、390px與條件／結果截圖。API限GET，無trees或AI；ambient CDN analytics另列。

real 模式只Flora真連線、真照片不stub；高程預設stub，PLANNER_REAL_TERRAIN=1才真高程。2026-10-24 real測得初始／elevation14／elevation12共3個GET，無POST；合規照片 https://inaturalist-open-data.s3.amazonaws.com/photos/462896397/medium.jpeg 實際decode成功。這不是全庫影像或版權核實。截圖 test-results/planner/{mock,real}-{desktop,mobile}-{conditions,results}.png。
