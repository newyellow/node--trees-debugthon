# Flora API 有界唯讀稽核

## 結論與範圍

- **可用：** 無金鑰植物搜尋、UUID、結構化詳情與照片 metadata，可作「待核實候選資料」入口。**不等於原生種、照片授權或適地適種品質認證。**
- **暫不可直接使用：** 原生種保證、可靠硬限制推薦、葉片辨識成果、景觀安全評分、可購苗圃清單。需來源交叉核對與 adapter。未知不能當相容。
- 2026-10-24 實際執行 **15 次 GET（含 OpenAPI）**，皆 HTTP 200，無 429、無重試、無 POST／註冊／登入／照片上傳，未下載任何影像。未改程式、公開資料、git/index、建置或部署。這是時間點抽樣，非全面普查。
- 原始回應、HTTP headers、UTC 時間、完整 query 與 SHA-256 留在私有 `test-results/flora-api-audit/`；下方編號對應檔名。input hash 定義為 UTF-8 `GET ` + 實際 URL（含序列化 query），response hash 為原始回應 bytes。完整帳本 `request-ledger.json`，確定性檢核 `checks.json`。

## 要回答的概念／觀測限制

|需求|可觀測欄位|判定|
|---|---|---|
|植物身分／原生性|UUID、學名、中文名、is_native/is_endemic、data_source|有值不代表已驗證；無來源分類ID或判定證據|
|適地條件|高度、海拔、光照、水分、耐鹽／旱／風、氣候、用途|有結構但混語言、null、多處敘述矛盾；需逐條驗證|
|葉片辨識／形態|texture、crown_shape；AI upload schema|沒有專用葉形／葉序／葉脈欄位或可靠辨識回傳契約|
|實體配置與安全|成熟高度上下限、樹冠形狀|無樹冠寬、根深／根系、管線淨空、場址空間／土壤調查；不可推論可種植|
|影像重用|image_url/license/attribution|metadata 可用；逐圖來源與授權版本仍需核對|
|採購|nursery_availability|僅 common/uncommon 等可得性文字，不是供應商／庫存|

## 實測：列舉與儲存值不一致

OpenAPI v0.1.0 的 filter 為 nullable string，**沒有 enum 驗證**；文件描述不等於實際儲存值。

- `GET /api/v1/plants/?sun_exposure=full_sun&limit=5` → total **0**（02）；只改 `全日照` → total **1,233**、取回5筆（03）。
- `GET /api/v1/plants/recommend?sun_exposure=full_sun&limit=5` → **[]**（08）；只改 `全日照` → **5筆**（09），5筆實際光照皆 `全日照`。
- 推薦 `water_needs=low&limit=10` → **2筆**，實際為英文 `low`（10）；只改 `低` → **10筆**，實際皆 `低`（11）。因此不只是「統一送中文」即可：英文及中文水分值同時存在，單一值查詢會漏另一群。10筆是 limit 截斷，不是全體數量。
- `sun_exposure=__audit_invalid__&limit=1` → HTTP200 **[]**（13），並非422；空結果不能解讀成現場沒有適合植物，也可能是 filter 字彙錯誤。

## 推薦限制與 null：驗證內容，不只200

- 無條件推薦 limit5（07）回傳5筆，介面為 `PlantRead[]`，沒有推薦分數、命中理由或規則版本。
- `salt_tolerance=high&wind_tolerance=high&elevation=0&plant_form=tree&limit=10`（12）回10筆：**10/10** 欄位是 tree、salt high、wind high，且有效海拔區間包含0。這只支持此組欄位限制在此樣本成立，不驗證生態正確性或其他參數。
- 但同一組中厚葉石斑木與毛苦參 `plant_form=tree`，description 卻稱「灌木」；不能僅靠 tree 欄位當作合格行道喬木。厚葉石斑木用途也列 hedge/foundation/coastal，並非 street_tree。
- `water_needs=low` 兩筆為掌葉酒瓶樹（海拔上下限皆 null）與西洋柏木（800–2700m）；再加 `elevation=0` → **[]**（15）。此對照顯示該樣本 null 海拔未被當成0m適生，且已知不合區間者被排除。不能推廣成所有欄位的 null 行為。
- 照片樣本12筆（04）有9筆 sun_exposure=null、3筆 water_needs=null、3筆海拔上下限皆null，12筆 landscape_use=null。缺失是「未知」，不是不限／零／相容。

## 原生旗標、文字與 provenance

- `q=馬纓丹&limit=5`（05）回4筆，包含 exact `Lantana camara`／馬纓丹，**is_native=true**，同筆 description 說 native to the American tropics。另小葉馬纓丹描述原生南美洲仍為true。這是高風險警訊，非憑少量樣本替全部植物重新分類。
- `q=大花咸豐草&limit=5`（06）total0；僅代表此字串搜尋未命中，不能推論資料沒有其學名／其他別名。此次未擴大查詢。
- `q=Acer serrulatum&limit=2`（14）命中1筆青楓；description 起首 **Acer oliverianum**，sun_exposure全日照、water_needs=null、elevation250–2210、climate_zones=[temperate]。學名與敘述需分類學／異名核對，不靜默合併；低海拔推薦不得只靠一般「原生」標籤。
- PlantRead `is_native` schema **default=true**、`is_endemic` default=false。這是模型預設，不是有來源的原生性判斷證據；不能從預設證明資料庫生成方式。
- data_source 出現 `TaiCOL + inat`、`TaiCOL + inat_synonym`、`TaiCOL + inat_alt`、`TaiCOL + inat,原景綠境` 等彙總字串；無逐欄位來源URL、觀測時間、trait測量方法、分類ID、來源版本或修改時間。不能把 TaiCOL 字樣當作所有栽培性狀皆出自 TaiCOL。
- 照片樣本12/12 description_source 與 description_license **null**；推薦baseline5/5亦皆null。不得因 API 公開就把整段文字視為可自由轉載。

## 照片授權（只讀 metadata）

`has_image=true&limit=12`（04）total **6,961**，預設排序前12筆，非隨機／代表性抽樣：12/12皆有 image_url、image_license、image_attribution；license 分布 cc0 **5**、cc-by **3**、cc-by-sa **3**、pd **1**。**12/12 metadata填寫，不是全庫授權通過率。**

來源URL為 Wikimedia Commons 縮圖、iNaturalist open-data S3等；授權多為短碼，缺精確版本及來源頁。pd亦缺法域／依據。正式重用需 source page、作者、授權URL與版本／變更註記；CC BY-SA 須審查相應義務。metadata聲稱CC0也不保證影像內容／身分正確。此次沒有為了測內容而下載圖片，故內容類型、實際畫面、葉片可辨識性、連結可用性與重新散布權均**未驗證**，不算照片辨識測試完成。

## 葉片／AI／景觀介面：僅 OpenAPI 靜態檢視，無 POST

- `POST /api/v1/ai/analyze`：**HTTPBearer**；multipart 必填 file（string, contentMediaType application/octet-stream），選填 latitude/longitude。200 JSON schema是空物件 `{}`，未承諾葉片辨識、候選物種、置信度或可校準錯誤率。沒有獨立 `/upload` path；這個 analyze 本身是檔案輸入界面。
- `POST /api/v1/design/analyze`：OpenAPI **未宣告 security**；JSON DesignAnalyzeRequest：plant_ids: UUID[] 必填、site_conditions: object|null 選填自由欄位；已在本機解析確認 `$ref` 有效。response 必有 total_plants、overall_score（integer）、categories（自由object）、top_suggestions（string[]），允許額外欄位；無分數範圍／公式、葉片資料格式或規則版本。不是已測試的景觀工程／安全評估。
- `POST /api/v1/design/suggest`：同樣未宣告 security，requestBody 已在本機解析確認同為 DesignAnalyzeRequest；200 schema `{}`，不可假設輸入或輸出契約。
- projects CRUD、ai/analyze、cad/generate宣告 Bearer。無 security 宣告不等於已實證匿名端點可成功；未送token亦未測POST。
- **隱私與模型 blocker：** schema 無模型／供應商、是否轉送第三方、訓練使用、保留／刪除、位置與EXIF處理、檔案上限／MIME驗證、儲存地點、使用者同意、速率限制與錯誤契約。必須先向維運方取得這些契約並獲明確上傳同意，才考慮測試合成／授權素材；不送使用者照片。

## 建議 adapter／採用門檻

1. 保留 raw + normalized + provenance/status；以UUID做外部ID，不以中文名直接合併。學名／異名另對權威分類資料，`is_native_verified` 預設 unknown，而非照抄true。
2. `全日照↔full_sun`、`半日照↔partial_shade` 可做明確映射候選；只有全日照已完成成對篩選實測，其他映射需補測。水分 `低/中/高↔low/medium/high`，查詢時須涵蓋混存值並去重；中／高映射目前只觀察內容，未成對驗證。不得由一個語言空結果自動宣稱無適生種。
3. 三態 hard constraints：compatible／incompatible／unknown；缺欄位與未知列舉皆 unknown，必填條件未知不得列入「已確認符合」。海拔需兩端有效且min≤max、site在區間；原生性與喬灌木矛盾需人工覆核。
4. 前端逐筆重驗 form、日照、水分、用途、耐性、海拔；保留排除／未知理由，與API推薦排序分開。不可將climate_zones或海拔當現場微氣候與道路條件證據。
5. 影像與文字分開授權；只在逐圖權利審核通過後展示／下載，提供署名與原頁；授權未知不設「可自由使用」。
6. nursery_availability僅顯示「來源標示常見／不常見，未查庫存」。無苗圃名稱、位置、聯絡、售價、庫存時間或供應商端點；**不得虛構可購店家**。
7. 上線前補 CORS／快取／逾時／429 Retry-After策略與端點契約測試；本輪未測瀏覽器CORS、壓力、其他限制組合或AI品質。若429應停止並遵守Retry-After，不循環重試。

## 請求證據索引

以下皆GET、HTTP200；完整params及input/response hash在相同編號meta檔（私有，不隨站點發布）。

|ID|UTC取回時間|實際相對URL|input SHA-256|
|---|---|---|---|
|01-openapi|2026-10-24T03:12:52.842323+00:00|`/openapi.json`|`14be808479cc745e924860135a86f580ed7dd8fd11866faec618febf249dfb97`|
|02-sun-en|2026-10-24T03:13:11.434839+00:00|`/api/v1/plants/?sun_exposure=full_sun&limit=5`|`5283123723b2cc2a19691a128874f863ca8a2639893e27c9f7118e1798301624`|
|03-sun-zh|2026-10-24T03:13:12.323561+00:00|`/api/v1/plants/?sun_exposure=%E5%85%A8%E6%97%A5%E7%85%A7&limit=5`|`583845d843bb98470577e58f53ce3eea181459e8245899e31492d3461de8108b`|
|04-photo-sample|2026-10-24T03:13:13.182646+00:00|`/api/v1/plants/?has_image=true&limit=12`|`bc8927e7ad9b4d281a7ac3a2c32082d6d350e8ddd1b2a8691f5eb1eeb47a3508`|
|05-lantana|2026-10-24T03:13:14.136967+00:00|`/api/v1/plants/?q=%E9%A6%AC%E7%BA%93%E4%B8%B9&limit=5`|`b05e8aa73766f519bc916a799bbdb6090d6a3118bf332b240674df214a809b7e`|
|06-bidens|2026-10-24T03:13:15.042375+00:00|`/api/v1/plants/?q=%E5%A4%A7%E8%8A%B1%E5%92%B8%E8%B1%90%E8%8D%89&limit=5`|`238ed2750219bd74a241b32f52129ccced1a691a4e974f0159e269b99631a9aa`|
|07-recommend-baseline|2026-10-24T03:13:15.961283+00:00|`/api/v1/plants/recommend?limit=5`|`5300ce611cc0f91871d271c225b37264976b344cfaf193bdbb3757ff2c9be6ff`|
|08-recommend-sun-en|2026-10-24T03:13:16.861540+00:00|`/api/v1/plants/recommend?sun_exposure=full_sun&limit=5`|`a1e85b66a9372d76a54b60d617e41255a4a9630a7d96c0bdba1eb47b59de0d20`|
|09-recommend-sun-zh|2026-10-24T03:13:17.768019+00:00|`/api/v1/plants/recommend?sun_exposure=%E5%85%A8%E6%97%A5%E7%85%A7&limit=5`|`12faafa173b93be36442e6a47164cbfdb7e377988127cd83b5d930f0f8f83b92`|
|10-water-en|2026-10-24T03:13:38.224452+00:00|`/api/v1/plants/recommend?water_needs=low&limit=10`|`3e05a9e52875ae73b88280b4fa1aa05cb7f094f23b283b6d61f59886d805f034`|
|11-water-zh|2026-10-24T03:13:39.116548+00:00|`/api/v1/plants/recommend?water_needs=%E4%BD%8E&limit=10`|`04e00d37855d82250925d0cba0649fbb25dcb7d187a250af9e7761ff94fbbc3c`|
|12-site-constraints|2026-10-24T03:13:39.994583+00:00|`/api/v1/plants/recommend?salt_tolerance=high&wind_tolerance=high&elevation=0&plant_form=tree&limit=10`|`d65ea428162c77160068cea959957e3094fb897d695f59a9899c26132a038c60`|
|13-invalid-sun|2026-10-24T03:13:40.897272+00:00|`/api/v1/plants/recommend?sun_exposure=__audit_invalid__&limit=1`|`dcbdef5b7b27ab54acf07049a8b169488ca1e168449b51b41d0318a6018a0b1a`|
|14-acer|2026-10-24T03:13:41.764873+00:00|`/api/v1/plants/?q=Acer+serrulatum&limit=2`|`8d668d7e5b2315c29c318c576898db1519cd66af47ca657c0c28610487abf587`|
|15-null-elevation|2026-10-24T03:13:59.853951+00:00|`/api/v1/plants/recommend?water_needs=low&elevation=0&limit=5`|`f50367c562b91c0c035048531d1f92d84bd9664b0319837612b473205c253bc4`|

## 來源與交接

- 本輪直接來源：https://flora-api.bankofculture.com/openapi.json 及上列實際回應。
- Parent前置回報 health200、stats總數/native_count皆7436、Cactaceae167：本輪為節制請求**未重抓**，不把轉述當作本輪獨立驗證。
- 本報告完成的是API資料／契約稽核；沒有實作介接或部署，不代表網站已提供這些功能。
