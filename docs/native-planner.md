# 原生植栽規劃室（workspace 03）

入口：`workspaces/03/index.html`。獨立 Leaflet 頁，不匯入既有 explorer；registry 整合由 parent 處理。

## 觀測契約

- 政策規劃組不是自然植物區系：陽明＝北投士林；內湖＝內湖松山中山；南港＝南港信義大安中正文山；河濱基礎組＝大同萬華。
- 河川四條（淡水河／基隆河／新店溪／景美溪）跨區，以及社子，全部使用者明確指定。沒有河川核實面域，不製造緩衝區或任意社子幾何。
- 按鈕才抓 BASE_URL + data/regions.json；實際 schema 是 FeatureCollection，其中 districts 是行政區 Feature[]（含 Polygon/MultiPolygon，properties.name/district），不是 villages features。只用 districts，不載入樹檔；點落區使用 point-in-polygon 含孔洞，重疊以名稱穩定排序。選區／點選顯示政策組，不能推論微氣候。
- 日照、水分、海拔、形態是使用者條件；樹穴長寬深、淨空、維護是選填本機記錄，絕不送 API 或當作適配證據。沒有根深／冠幅資料，不提供實際密度、株數、株距、安全或樹穴合格判定。
- 照片只接受 12MB 以下 JPEG/PNG/WebP File input + objectURL。換圖／清除／重設／pagehide revoke；不讀 bytes、不 POST、不 AI、不持久化、不推定土深。瀏覽器測試用合成單像素圖，無私人照片。

## API 有界 adapter

來源 [OpenAPI](https://flora-api.bankofculture.com/openapi.json)、[審核](research/flora-api-audit.md)。只 GET search/recommend/UUID detail，無 auth/project/design/AI 操作。明確查詢或至少兩字搜尋 debounce 650ms，每次最多 12 筆，單一 in-flight、AbortController、版本 stale guard、12s timeout、24項 session memory cache，無分頁／批抓／random／自動重試。429 記錄 Retry-After 秒數或日期；沒有則至少60秒，冷卻期間阻止 API。重試由使用者按鈕發出。

重要：sun_exposure 全日照 vs full_sun、water_needs 低 vs low 混存。為避免單語硬篩漏群，日照與水分 **不送 server filter**，只對取回最多12筆做 raw+canonical 三態比較，並非完整的符合植物搜尋；保留不符與未知，不做假分數。q、plant_form、elevation 是 allowlist；海拔需0–9000整數。API先篩形態／海拔會改變母群且可能排除未知，上線頁面明說限制。推薦端點提供排序不是工程認證，空結果是本次 query 未命中，不是沒有適生植物。

is_native/is_endemic 旗標不可信為核實名錄。已知 Lantana camara、L. montevidensis 旗標矛盾警告並阻止加進原生草稿；其餘全標「API候選／原生身分待覆核」，不是白名單。Acer serrulatum 描述提到 A. oliverianum，不靜默合併；所有描述一律不轉載。

影像：僅 explicit CC0，或 CC BY/BY-SA 且有實際署名及獨立 HTTPS source URL 欄位才展示。API目前常缺來源頁，因此非CC0多會隱藏。NC/ND/PD/unknown 隱藏；HTTPS、無user/password；署名原樣 textContent、no-referrer、來源連結。CC0 metadata仍非獨立版權驗證，正式重用仍待逐圖核對。description 完全不進 DOM。文字用 textContent、不拼植物 HTML。葉形分析不可用；texture/crown_shape 僅為來源事實欄。

## 配植與採購

草稿只存在頁面記憶體，手動加入移除，依 tree/shrub/herb/groundcover/vine/aquatic + unknown 結構分組；共享日照／水分只比較已知值，一致不保證相容，混合值提醒需分區。沒有自動比例、數量、庫存或 design score。田尾目前沒有供應商、聯絡、庫存、價格，列明待提供欄位而不捏造。

## 驗證

使用現有 Chrome channel 與 Node24 絕對路徑，無安裝、無 dist build。

~~~sh
node --test tests/native-planner.test.mjs
# existing dev server at 5193 (or NATIVE_PLANNER_URL override)
node scripts/check-native-planner-browser.mjs
node scripts/check-native-planner-browser.mjs --real
~~~

單元：12區政策、覆寫、混語映射、null/zero、限制不符、query allowlist、URL/授權、孔洞、混植未知、cache/429/stale。
瀏覽器 mock：真實本機 regions、stub底圖，桌機／390px、選區／選點、候選／詳情、shortlist、合成照片本機預覽及清除、空推薦、503重試、無樹木資料或POST。real：實際瀏覽器 CORS GET 搜尋／詳情／filter+recommend，影像 stub不下載，仍驗證照片不導致API流量。兩者分開報告。


## Public integration verification
2026-10-24: prototype published at /workspaces/03/index.html; portal metadata exposes this entry. Parent added four policy-group colors and legend, malformed-record rejection and image-load fallback. Clean committed snapshot:143 tests,141passed,2skipped; public mock/real API browser checks pass desktop/mobile, including real lazy photo load and local photo preview without API upload. Existing same-origin Cloudflare /cdn-cgi/rum analytics POST is separately reported, not a planner data upload; no analytics configuration changed. Public existing vegetation/raw-village regression and HTML comparison preserve other features.

This is not the completed native species recommendation product: no per-region200-species cited inventory, verified native status, root-space suitability/density model, AI photo analysis, or Tianwei supplier/stock feed. These remain explicit data/validation gates, not successful empty results.
