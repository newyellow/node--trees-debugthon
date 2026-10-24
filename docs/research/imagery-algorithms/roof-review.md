# RGB 航照屋頂辨識：臺灣與國際方法查核

查核日期：2026-10-24。範圍：文獻、公開程式與資料說明；沒有下載影像／模型、安裝套件、訓練或推論。本報告不是已完成的屋頂偵測器，也沒有產生候選屋頂。

## 結論與現況

**建議先以現有授權範圍的小樣本做「屋頂分割 → 材料分類 → 人工複核」分階段驗證，不擴張 PHOTO2 影像抓取。** RGB 可以支援可見表面輪廓與外觀材料的研究，但不能直接證實平坦度、金屬材質、違建身分或植栽適宜性。國外成果只支持方法值得測試，不能當成臺北精度。

依本庫 docs/vegetation-pilot.md：目前 PHOTO2 為 RGB，沒有 NIR／高度；拍攝日期與 native GSD 未知。z19 約 0.2705 m/pixel 是顯示取樣，不是原始解析度；水印年份不是拍攝日期。12 磚只覆蓋 5.729 ha，屋頂層未實作且沒有候選證據。零候選在此是未分析／不可用，不是區域沒有屋頂。

## 必須分開的四種目標

| 目標 | 可操作觀測與標註 | RGB 限制／必要補充 | 可發布名稱 |
|---|---|---|---|
| 建物基底 footprint | 建物與地面相交範圍；地籍／官方建物輪廓 | 與可見屋頂有出簷、視差、傾倒和年代差；不能直接當屋頂真值 | 建物輪廓／先驗 |
| 可見屋頂 roof surface | 航照上可見屋面逐像素或逐實例輪廓；遮蔽區不臆補 | 道路、停車場、貨櫃、遮雨棚、太陽能板皆需負例；屋面投影面積非實際斜面積 | 待複核屋頂候選 |
| 屋面材料 metal/concrete/tile/etc. | 個別屋面材料標籤；混合屋頂需分區或 mixed；unknown 必備 | 顏色／條紋不能排除石綿水泥浪板、塑膠、塗裝水泥；需可信現勘／高品質已知材料標籤 | 疑似金屬外觀（未驗證時） |
| 平屋頂與植栽適宜性 | 平坦度／坡度需 DSM、LiDAR 或多視角；植栽另需載重、防水、排水、權屬、通達與安全 | RGB 單張沒有結構承載、隱藏設備、法規與管理權證據；金屬棚頂也不是適宜種植 | 平坦外觀待查；植栽適宜性 N/A |

非綠色補集 ≠ 屋頂；屋頂分割 ≠ 金屬證據；平坦外觀 ≠ 可種植。不能把這四個分類器的信心相乘當成校準後的適宜性機率。

## 8 項查核來源

下列「已讀」明列證據層級。論文 CC 授權不自動涵蓋其影像、標註、程式或權重；未驗證不等於不存在。查核使用公開網頁、Crossref 與 OpenAlex；未使用不可用的通用搜尋服務。

### 1. 臺灣：Mapping Asbestos-Cement Corrugated Roofing Tiles with Imagery Cube via Machine Learning in Taiwan（2022）

- 正式來源：https://doi.org/10.3390/rs14143418 ；https://www.mdpi.com/2072-4292/14/14/3418
- 已讀：[Crossref 出版者摘要與作者機構](https://api.crossref.org/works/10.3390/rs14143418)、[OpenAlex 記錄](https://api.openalex.org/works/W4285803943)。作者包括成功大學資源工程學系、衛星資訊研究中心及中興測量公司。MDPI 正文 HTTP 403；**未讀全文**。
- 摘要明載：400 ground-truth samples；以航空高光譜掃描建立材料真值，20 個樣本另做 X-ray 檢測；SVM 與 CNN 結果交集、pixel growth 建多邊形，並以後期 Sentinel-1 處理不同期影像的落差。摘要稱超過 85% accuracy，亦提 85% kappa 要求；兩者不能混成同一指標或挪用至 PHOTO2。
- 有用之處：臺灣浪板材料區分必須有可靠真值與時序查核，並示範傳統機器學習與 CNN 比較；**目標是石綿水泥，不是金屬鐵皮**。摘要不足以確認其實際分類輸入全部為 RGB，不能宣稱 RGB-only 已解決此題。
- 授權／資產：文章 Crossref 記載 CC BY 4.0；本次未查得已驗證的公開程式、權重或可直接重用的 400 筆標註授權。
- Mac：SVM 小樣本可列為低成本基線，但完整重現需取得原始特徵、標籤與流程；目前不具可直接推論條件。

### 2. 臺灣：Using convolutional neural networks to identify illegal roofs from unmanned aerial vehicle images（2023 線上出版）

- 正式來源：https://doi.org/10.1080/17452007.2023.2244949
- 已讀：[Crossref](https://api.crossref.org/works/10.1080/17452007.2023.2244949) 核實作者 Ching-Lung Fan、陸軍官校土木工程學系；[OpenAlex 摘要](https://api.openalex.org/works/W4385637942)。DOI 取得 HTTP 406；沒有全文。
- 摘要：UAV 建正射、3D 建物及 DSM，400 illegal + 400 legal 影像供 CNN 分類，另用 YOLOv3 與 DSM >9 m 疊合。96.0% 是該研究的分類正確率，不是本地像素分割或金屬辨識率；資料切分與外區泛化未由全文核實。
- 有用之處：臺灣情境的物件候選與高度輔助；但 PHOTO2 沒 DSM，且「違法」是行政／法規標籤，不是可從外觀移植的材料標籤。不得將 YOLOv3 當成現成鐵皮模型。
- 授權／資產：本次未驗證公開程式、權重、800 影像取得方式或重用條款。Mac 本地重現受資料與高度缺口阻擋。

### 3. 國際：Open AI Caribbean Challenge: Mapping Disaster Risk from Aerial Imagery（DrivenData／World Bank／WeRobotics）

- 已讀：[競賽與成果](https://www.drivendata.org/competitions/58/disaster-response-roof-type/)、[優勝程式與方法](https://github.com/drivendataorg/open-ai-caribbean)、[MIT LICENSE](https://raw.githubusercontent.com/drivendataorg/open-ai-caribbean/master/LICENSE)。
- 任務是對**已提供建物多邊形**分類屋頂材料，不是從整張航照尋找所有屋頂。範圍為 St. Lucia、Guatemala、Colombia。頁面說明五種材料類別；本次頁面未完整取得類別字典，不自行補出精確機器標籤。
- RGB 裁切加 polygon mask；優勝隊採 CNN + polygon／位置／鄰居特徵的 GBM，另一方案用 ResNet18/50/101。可借用「先定位、後材料」設計。位置／鄰居材料特徵可能造成地理洩漏或學到地區先驗，在臺北評估先拿掉。
- 官網宣傳 87% correctly identified 不等於 repo 表格 0.354327 private score；後者頁面未在表格旁定義指標，不能互換，也不能作臺灣效能保證。
- 程式 MIT 已核實；**資料與權重的獨立授權、公開下載與現行可用性未核實**，不能因程式 MIT 就發布訓練影像。沒有下載任何檔案。
- Mac：從單一小 ResNet 類的 mask crop classifier 起步比多折多網路集成實際；舊相依套件／權重載入及 Apple MPS 相容性尚未測。須新增臺灣材料標籤並獨立測試。

### 4. 國際：Can Semantic Labeling Methods Generalize to Any City? The Inria Aerial Image Labeling Benchmark（IGARSS 2017）

- 已讀：[Inria 官方資料頁](https://project.inria.fr/aerialimagelabeling/)，頁面實際提供論文題名與 [HAL 論文連結](https://hal.inria.fr/hal-01468452/document)；未另外讀 PDF。
- 官方資料頁：810 km²、訓練／測試各 405 km²、0.3 m 正射彩色影像，building / not building 二類；不同城市分置訓練／測試。來源結合 public-domain imagery 與 official building footprints。
- 有用之處：RGB 建物分割的前訓練或比較資料，尤其可借用跨城市切分避免鄰接磚洩漏。**無金屬／平屋頂標籤**，footprint 標註不等於 PHOTO2 可見屋面真值。
- 資料頁明稱組成資料 public domain，但本次未逐包檢查下載合約及個別來源授權；發布衍生資料仍需確認。沒有附帶本次驗證可用的屋頂材料權重。
- Mac：小 U-Net 類模型可作批次推論概念方案；原圖需切片，不能一次整景載入。須按未知 native GSD 做尺度敏感性測試，不能直接當等解析度。

### 5. 國際：TernausNet: U-Net with VGG11 Encoder Pre-Trained on ImageNet for Image Segmentation（2018）

- 已讀：[正式 arXiv 摘要](https://arxiv.org/abs/1801.05746)、[作者 repo](https://github.com/ternaus/TernausNet)、[MIT LICENSE](https://raw.githubusercontent.com/ternaus/TernausNet/master/LICENSE)。arXiv ID 由作者 repo 引用後再核實，非猜測。
- 預訓練 encoder + U-Net decoder 是低標註量分割基線；repo 以 Inria 展示 aerial IoU 訓練曲線。論文摘要亦包含 Carvana 車輛分割設定；**公開預訓練不代表權重已懂臺北屋頂或金屬材質**。
- 程式 MIT 核實；摘要稱公開對應權重，但各 checkpoint 的訓練資料、任務、獨立條款／可用性未逐一檢驗。不可把 ImageNet encoder 或 Carvana 權重稱為屋頂 detector。
- 標註：需要臺灣可見屋頂 mask；材料須另標。Mac：CPU 小 chip 可列測試起點；VGG11 不是最省記憶體的 backbone，可與輕量 encoder 的同類基線比較。無本機時間／記憶體實測。

### 6. 國際：Improving Semantic Segmentation of Roof Segments Using Large-Scale Datasets Derived from 3D City Models and High-Resolution Aerial Imagery（Remote Sensing 2023）

- 正式來源：https://doi.org/10.3390/rs15071931
- 已讀：[OpenAlex 摘要及機構](https://api.openalex.org/works/W4362558675)：Technical University of Munich；出版者頁 HTTP 403，[TUM 機構記錄](https://mediatum.ub.tum.de/1706056) timeout。**全文與程式未取得**。
- 摘要：由 semantic 3D city models 自動產生屋面分段／朝向標籤，資料量較既有大 50 倍；同區 IoU 0.60→0.70，多樣化測試 0.635。這是其特定分段評估，非材料辨識率。
- 有用之處：平屋頂／朝向有自己的標註需求；3D 模型可以生成 supervision，不可只拿建物二元 mask 訓練後宣稱平屋頂。
- 文章 metadata 標示 CC BY；資料、程式、權重的獨立授權／下載未核實。PHOTO2 無高度及本地 3D 標籤，現在不宜承諾重現；日後可評估取得同年代授權 DSM／3D 建模資料。

### 7. 國際工具：Segment Anything（SAM，2023）

- 已讀：[官方 repo](https://github.com/facebookresearch/segment-anything)、[README 原文](https://raw.githubusercontent.com/facebookresearch/segment-anything/main/README.md)、[Apache-2.0 LICENSE](https://raw.githubusercontent.com/facebookresearch/segment-anything/main/LICENSE)。
- 依點／框 prompt 產生物件 mask，亦可自動產生無語意 masks；有公開 checkpoint 說明與 ONNX mask decoder 路徑。它**不是屋頂／金屬／平坦度分類器**，適合人工點選屋面加速標註，再修正邊界及遮蔽。
- README 稱 model Apache-2.0；SA-1B dataset 是另行 Research License，不是 Apache。不得混稱資料可自由再散布。
- Mac：選小 checkpoint、每張 image embedding 重用、CPU fallback 可作未驗證方案；README 強烈建議 CUDA，沒有在本機驗證 MPS／延遲／峰值記憶體。ONNX decoder 並不表示整個 encoder 已可無成本在瀏覽器執行。

### 8. 國際工具：Raster Vision

- 已讀：[官方 repo](https://github.com/azavea/raster-vision)，明載 Apache-2.0，PyTorch 後端，支援 chip classification、object detection、semantic segmentation、地理參照輸入輸出與模型封裝。
- 有用之處：切片／重疊／地理座標結果的管線參考，而不是現成金屬屋頂模型。它不提供本題已驗證的材料權重或臺灣標註。
- Mac：可研究 Python library 的 CPU 小批次方式；地理套件 ARM 相依與 PyTorch/MPS 未驗證，Docker/CUDA 工作流不應直接照搬到 Mac。本次不安裝；目前原有 Node／Chrome 影像工具不代表已具模型執行環境。

## 臺灣學位論文查找與不可取得範圍

已實際查詢 OpenAlex 的「屋頂 影像 辨識」「鐵皮 航照」「鐵皮屋」以及英文 Taiwan roof aerial / roof Taiwan UAV illegal；中文命中多為無關文獻，不列作成果。已開啟 [國圖臺灣博碩士論文系統](https://ndltd.ncl.edu.tw/)，擷取僅回首頁標題，未取得可核實之特定論文全文／題錄。本輪**沒有查得可引用的臺灣相關學位論文**，不能說臺灣沒有研究；上列兩篇有作者／機構核實的國內期刊研究取代之。後續需圖書館／機構庫可查介面或作者授權資料，不虛構論文題名、校系與下載網址。

## 推薦分階段方法（設計，不是實作狀態）

1. **資料與授權閘門**：先記錄既有 12 磚 provider terms、來源 hash、覆蓋／nodata、未知日期與 GSD；分清 display resolution/native GSD。先釐清衍生多邊形發布權，再考慮更多授權區域資料。現有浮水印不可裁除後發布，不能以取得成功代替授權。此次不擴張下載。
2. **標註與可觀測性閘門**：在既有範圍人工分層抽樣屋面、地面、遮蔽物；屋面 mask 與材料標籤分開。材料先用 metal-looking / concrete-looking / tile-looking / mixed / unknown 的外觀標籤；有可信真值才升級材質名稱。至少雙人複核一部分、記錄 disagreement；實際所需樣本量由類別覆蓋與 learning curve 決定，不憑空保證 400 筆足夠。既有 12 磚可能太同質，無足夠類別就只交付標註可行性結果。
3. **廉價基線**：建物先驗僅作 prompt/ROI；RGB 顏色、GLCM／局部紋理、邊緣與規則線條 + RF/SVM 作可解釋比較。不能用非綠色生成屋頂標籤，也不能以「藍／紅色」直接決定金屬。陰影、反光、白色水泥與浪板混淆須保留 unknown。
4. **兩階段學習**：先用小 U-Net 類分割可見屋面；以經修正 mask 裁切做單一小 CNN 材料分類。先比純 RGB 與 mask crop，不急著疊 GBM、多折 ensemble 或 SAM 全自動 masks。SAM 優先作點框互動標註工具；各模型資產與套件需另行授權批准後才下載／安裝。
5. **獨立評估與拒判**：按完整建物及空間 block 分割 train/validation/test，防同屋頂跨磚、相鄰／重複裁切洩漏；樣本太少無法設獨立測試時明寫不可量化泛化，不報虛假精度。屋頂報 IoU、boundary F1、object precision/recall；材料報逐類 precision/recall、macro-F1、混淆矩陣、校準與拒判覆蓋率；未知／遮蔽另外統計。保留跨來源／跨區外部測試作後續閘門。閾值由人工複核成本與驗證集訂定，本文不捏造合格率。
6. **幾何與本地效能**：512×512 是可測起點而非已驗證最優值，採 overlap、邊界捨棄或 blending，先拼機率圖再 polygonize，避免磚縫斷裂；nodata 不變背景。投影面積用 TWD97 公尺 CRS，保留洞、來源與邊界截斷標記。未知道 native GSD 時不能把未分辨的小紋理當材料證據；重採樣不創造真細節。
7. **Mac 執行閘門**：小批次 CPU baseline → 驗證 MPS operator 與數值一致性 → 測 p50/p95 每 chip 時間、峰值記憶體及完整 mosaic 吞吐。記錄模型／checkpoint hash、輸入尺度、前處理、硬體與套件版本。現在未執行任何推論，因此沒有宣稱吞吐或可在現有 Mac 即開即用。
8. **保守交付**：證據足夠才顯示「待複核屋頂」或「疑似金屬外觀」。flatness 未驗證為 N/A，植栽適宜性維持 N/A，不給可種植面積、不加進已驗證綠地或植栽容量分數。後續取得高度／材質真值／結構評估是不同的資料與授權工作。

## 尚缺證據／不能宣稱

- 沒有 PHOTO2 專用／臺北已驗證屋頂 mask、材料真值、校準信心或模型 checkpoint。
- native GSD、拍攝日期、正射幾何品質與不同來源拼接差異仍未知。
- 無 DSM/LiDAR／多視角，因此沒有實測坡度、坡向、平屋頂標籤及可用平面積。
- 國內兩篇只有摘要／題錄可讀，未核對全文資料切分、完整特徵與資料重用條款；摘要的 85%／96% 不能轉成此產品效能。
- 金屬 vs 石綿水泥／塑膠浪板／塗裝水泥的外觀歧義尚未解；石綿不得用一般 RGB 視覺宣稱確診。
- 未核實加勒比海資料／優勝權重的獨立授權與現行取得，Inria 也未逐包檢查；程式開源不等於所有資料可公開。
- 缺承載、防水、排水、法規、權屬、通達與現場安全資料，不能推植栽適宜性。
- 此次只新增本文件，不改演算法、資料、UI、索引、git 狀態操作或部署。

