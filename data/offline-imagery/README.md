# 離線分析影像

此目錄僅供團隊離線分析。原始下載圖磚與逐圖來源側錄不納入 Git；保留需求、邊界及盤點報告。2026-10-27 已移除工作樹中的既有圖磚；舊 Git 歷史仍含副本，未改寫歷史。未完成下載的 `.part`、暫存 `.tmp` 與下載續傳識別檔仍排除。不放在 `public/`，不隨網站建置發布。含權杖的下載連結或個人申請資訊請勿存入受追蹤檔案。

目前沒有完整的全市影像包。開發環境可逐步快取實際瀏覽的航照圖磚；`npm run imagery:plan` 則只會建立申請範圍及容量估算，不會下載或送出申請。

## 瀏覽時保存本機圖磚

啟動或重新啟動 `npm run dev` 後，航照圖磚會經由本機快取：

1. 先讀 `tiles/{官方圖層}/{z}/{y}/{x}.jpg` 或 `.png`，有檔案就不請求官方。
2. 缺少時，才下載當前瀏覽的圖磚，原樣保存；同一張圖磚的並行請求共用一次下載。
3. 每張附 `.json`，記錄官方位址、下載時間、z/y/x、EPSG:3857 及 SHA-256。下載時間不是拍攝時間；錯誤頁不存入快取。

此方式只累積已瀏覽範圍與縮放層級，**不代表全臺北或各年度已下載完成**。不預載其他年度或縮放層級、不遍歷全市。已存影像可離線供分析程式讀取；地理範圍可由附帶的 z/y/x 與 GoogleMapsCompatible 矩陣換算。檔案保持來源浮水印，不做重新壓縮。

只讀離線快取、不允許航照缺圖時請求官方，可用：

```sh
IMAGERY_OFFLINE=1 npm run dev
```

未下載的圖磚會顯示載入失敗，可回到已快取範圍或恢復一般開發模式。這只控制航照；街道底圖仍使用 OpenStreetMap，因此不代表整個網站完全離線。正式 `npm run build` 使用官方航照網址，不帶本機快取端點或影像。`latest` 或年度圖層日後可能更新，本機已存版本不自動更新；需要更新時先備份該圖層目錄，再移出快取以重新取得。快取目前無容量淘汰，請自行管理磁碟空間。

本機保存與公開發布是不同用途，但不代表可忽略來源對大量下載的限制；全市高解析度資料包仍使用下述官方申請管道。

## 全臺北、樹冠分析優先

```sh
npm run imagery:plan
```

產生：

- `request.md`：可供檢查與複製的申請規格、範圍座標及用途。
- `request.json`：2022–2025 年的需求、解析度需求與估算；不是影像完成清單。
- `taipei-boundary.geojson`：由專案既有官方 12 區邊界產生的 WGS84 分析遮罩，涵蓋臺北全市及山區。

優先向供應單位取得 **10–30 公分原始地面解析度的 GeoTIFF**、實際拍攝日期、坐標系統及離線分析使用條件；此解析度是需求，尚未確認有可下載產品。RGB 影像只能作 RGB 樹冠分析，不能計算需要近紅外線的 NDVI。

替代方案為[國土測繪中心離線地圖申請](https://maps.nlsc.gov.tw/T09/mapshow.action?In_type=web&showOm=true)：選 MBTiles、臺灣通用正射影像、僅框選範圍的 16–19 層。第 19 層在臺北約每像素 27 公分的顯示尺度，不代表原始解析度；框選範圍如受限制，請依 12 區分批申請，保留各區分包。表單需要本人姓名、電話、Email 與用途，並經 Email 驗證及核准後才寄下載連結。**目前表單沒有歷史年度選項，不能假設能從此處取得 2022–2025 全部版本。** 年度需求需向供應單位另行確認；最新拼接包應使用 `latest`，不能標成 2025 拍攝。

官方[服務條款](https://maps.nlsc.gov.tw/pro/use_clause.jsp)限制大量下載，官方[操作手冊](https://maps.nlsc.gov.tw/downloaddoc/UserManual.pdf)另提供上述離線地圖申請流程。本工具下載的是申請後取得的單一檔案包，不會遍歷 WMTS 抓取全市圖磚。供應單位也可參考[航測及遙測分署的圖資取得說明](https://www.asrs.gov.tw/faqs)。

## 取得官方檔案後

已用瀏覽器下載的 MBTiles、ZIP、TIFF，可匯入：

```sh
npm run imagery:import -- --file /absolute/path/to/approved.mbtiles --year latest
```

或以官方核准後的 HTTPS 檔案網址下載（可續傳；不要將含權杖的網址提交到 Git）：

```sh
read -s 'IMAGERY_DOWNLOAD_URL?貼上官方檔案下載網址：'
export IMAGERY_DOWNLOAD_URL
npm run imagery:download -- --year latest
unset IMAGERY_DOWNLOAD_URL
```

以上 `read` 寫法適用專案開發環境的 zsh。若連結逾期，先向官方取得新連結；來源 URL 改變時工具會保留舊的 partial，避免混合不同來源。伺服器不支援續傳時，保留或移走 `source.part` 再重新下載。

檔案依 `latest/taipei/` 或 `2022/taipei/`～`2025/taipei/` 保存。若依區分包，匯入或下載時加上 `--part beitou` 等分包名稱，即會保存到該年度的獨立子目錄，避免覆蓋。`manifest.json` 記錄下載時間、大小與 SHA-256，網址僅保存 origin 和雜湊，不保存權杖。已保存檔案會驗證雜湊後跳過；不同來源不覆蓋既有影像。未完成下載保留 `source.part`。

檔頭檢查可攔截誤存成影像的 HTML 錯誤頁，但尚未檢查壓縮檔完整性、MBTiles 資料表、實際涵蓋範圍或清晰度。取得後仍需在 QGIS 檢視、核對拍攝日期及範圍。MBTiles 的資料表列通常使用 TMS 的 y 方向，不能直接當 XYZ 讀取；GeoTIFF 則以檔內 CRS/GeoTransform 為準。分析產物可放在本目錄下自行建立的 `derived/`。
