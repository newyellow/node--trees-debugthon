# 預生成建議閱讀介面

- 前端只 GET 同源 `base + data/precomputed-advice/<villageId>.json`，附固定版本查詢參數；固定版本為 `4577aeaa30f65e6052df3bc5d9aef737f3d8f7cc9f5eeb82df5982800c70efab`。
- 驗證 schemaVersion=1、精確 villageId、模式及版本；空答案、缺模式、格式錯誤、非安全 HTTPS 引用與 home 導覽均拒絕，不回退即時生成。
- 無輸入框、表單、聊天送出、對話紀錄或 live stream import。INITIAL_MESSAGES 僅保留舊測試相容資料，沒有網路用途。舊 adviceEndpoint/boundedHistory/validateAdvice 匯出已移除；舊 live-chat 測試須由整合者退役或改寫。
- 明示「預生成建議・逐字播放」。逐字呈現完全在本機進行；減少動態效果時直接顯示。讀取逾時 30 秒可重新讀取，錯誤及重試只讀靜態檔。
- AbortController 加世代 token 防止停止、關閉、切里、切模式及重開後的舊資料或計時器覆寫。停止保留已呈現內容；可重新讀取，不發送推論。
- 只有 planting 且明確 tour.kind=four-region-vision 才啟動既有 onVision；減少動態時不啟動。切換、停止、關閉取消 tour handle，既有 finished 生命週期保留。
- 固定 AI 註記僅在答案播放完成後出現一次。引用保留安全 HTTPS 連結，文字使用 textContent。
- 既有 pictures / exact identity / appendPlantDetails / figures.attach 路徑保留：候選照片、圖說及描述仍查既有 flora API / Wikimedia 來源，不採用建議檔內圖片或描述。
- 此介面不傳使用者輸入、不呼叫 AI 推論、不產生本次推論費用；仍有靜態建議及植物參考來源讀取，並保留現地查核、人寵與居家環境限制說明。

## 驗證

執行 node --test tests/cached-advice.test.mjs。涵蓋 prefix/version、驗證失敗、safe HTTPS、Unicode 逐字、reduced motion、abort/stale、關閉重開、模式切換、retry、tour cancellation，以及 fetch spy 證明所有建議請求均 GET 靜態資料，無推論請求。測試全用替身，不呼叫真實 AI。

靜態分片投影、伺服器禁用 live、整體建置與公開 UI 操作檢查由主整合者負責。

## Integration verification

Parent verified8 directly affected loader/playback/panel/backend/projection checks, including inference spies and exact456×2 public projection comparison. One1100×800 actual village interface check verifies cached home text equals saved text, local stop/reload playback, mode switching/close/reopen stale protection, reduced-motion instant reading, no composer, one fixed AI quote, runtime plant-API calls, and zero inference requests/JS errors. Plant API responses were mocked only for this scoped UI check; identity/photo/description rendering code was preserved, not regenerated or stored. Ten old live-HTTP integration expectations are explicitly skipped as superseded; retained batch/model/identity tests are not a gate rerun. The prior live UI endpoint/history tests are replaced by cached-only tests rather than retaining obsolete exports.

Explicit authorization1563519513310400614 allowed only two additional real generation calls: both specified home records succeeded on attempt2; original910 successes/results/attempts remained byte-equivalent. Final912 successful jobs/914 attempts, no automatic retry. Runtime SQLite backups remain private. Public files contain only saved answer/candidate metadata/citations/tour kind; no image bytes/URLs or Flora descriptions.
