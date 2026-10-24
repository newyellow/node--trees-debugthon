# RGB 航照樹冠／植被分割研究

核實日期：2026-10-24。僅研究；未下載影像或模型、未安裝套件、未上傳雲端。

## 結論與觀測界線

推薦先在既有 12 張 PHOTO2 快取比較 RGB 基線、normalized 綠度與陰影／未知處理，再評估 SLIC 物件化；名稱維持「RGB 植被候選」，不能直接改稱樹冠。若另核准本機模型、授權及標註工作，首選小型 U-Net 語意分割。DeepForest 是獨立樹冠框偵測對照；SAM 適合人工輔助標註，不是自動樹木分類器。

依 docs/vegetation-pilot.md：現有 12 張瓦片約 5.729 ha，z19 顯示取樣約 0.2705 m/px，**不是已知原生 GSD**。拍攝日期及原生 GSD 均 null；NLSC2024 浮水印不是拍攝年證據。RGB 無 NIR，不可計算 NDVI；沒有 CHM/DSM，不能以高度區分樹、灌木與草。可見綠色不是全部植被、天然綠地或公共可及綠地；冠投影 mask 不是單株數、樹種或冠下植被。任何外地 benchmark 都不能移植為臺灣／PHOTO2 精度。

## 八組已核實的原始／官方來源

每組主來源已實際讀取；相關授權及文件補證列於各組。未下載 checkpoint 或壓縮檔，未核實其中二進位內容。

### S1 DeepForest：bounding boxes 與 segmentation 必須分開

- [官方 repo](https://github.com/weecology/DeepForest)、[官方文件](https://deepforest.readthedocs.io/en/latest/)、[Tree Crown Detection in RGB Airborne Imagery 模型卡](https://huggingface.co/weecology/deepforest-tree/blob/main/README.md)。README 明寫以 RGB 預測單株樹冠 bounding boxes。
- 輸入航空 RGB；遷移訓練需本地框標註。模型卡描述 LiDAR 產生初步訓練標註、再用人工 RGB 標註改善，**不表示推論一定需要 LiDAR**。
- 輸出框與偵測分數，不是冠界 mask。框面積／框聯集不能當冠投影面積；密接冠、小樹、陰影及不同取樣比例需分層驗證。
- 程式 [MIT](https://raw.githubusercontent.com/weecology/DeepForest/main/LICENSE)；上述權重模型卡亦明列 license: mit。須固定實際套件版本、模型 revision 與 hash，不能泛化到所有同名模型。
- 本機可列有限框偵測對照；未測 Mac 相容性、耗時或記憶體，不能稱即裝即用。

### S2 U-Net: Convolutional Networks for Biomedical Image Segmentation（Ronneberger, Fischer, Brox，2015）

- [作者官方頁](https://lmb.informatik.uni-freiburg.de/people/ronneber/u-net/)，DOI 10.1007/978-3-319-24574-4_28。
- 可設計輸入 RGB patch、以逐像素類別 mask 訓練；輸出語意分割。建議類別：可辨樹冠／其他植被／非植被；不可判讀 ignore，另記陰影 QA 層。語意冠 mask 不自動分單株。
- 原作是生醫分割，非臺灣航照冠層 benchmark；只借 encoder-decoder、skip connection、overlap-tile 思路，不借其精度。需防空間洩漏、類別失衡、尺度與光照偏移。
- 官方 release 是細胞模型、Caffe/Matlab 等，只列 Ubuntu 14.04／Matlab 2014b 測試，不能當樹冠權重。
- 授權：已讀主頁未明列足以判定整包程式／權重使用與再散布的條款，標為**未核實，不採用該 release**。架構名稱不是實作授權；另選實作、encoder 與 checkpoint 須各別核對。
- 若後續核准環境與標註成本，小型 U-Net 是優先本地語意基線；本次未訓練或測速。

### S3 SegFormer: Simple and Efficient Design for Semantic Segmentation with Transformers（Xie et al.，NeurIPS 2021）

- [官方程式與權重說明](https://github.com/NVlabs/SegFormer)，arXiv:2105.15203。RGB 輸入，訓練需本地像素標籤；輸出語意 mask。官方列 ImageNet encoder、ADE20K／Cityscapes 示範，不是已驗證的俯視樹冠權重。
- 限制：俯視／街景 domain gap、草冠混淆、陰影與混年影像；B0/B1 可列比較候選，不能因 transformer 名稱就推定較準。
- **授權門檻**：[官方 LICENSE §3.3](https://raw.githubusercontent.com/NVlabs/SegFormer/master/LICENSE) 限 non-commercial，且定義為 research or evaluation purposes only；README 也明示。不是一般商用寬鬆授權，未釐清前不接公開產品。換框架不會改變官方權重條款。
- 官方範例用舊版 MMSegmentation/mmcv/CUDA；未證實 Apple Silicon 可直接跑，非當前首選。

### S4 Masked-attention Mask Transformer for Universal Image Segmentation（Cheng et al.，CVPR 2022；Mask2Former）

- [官方 repo](https://github.com/facebookresearch/Mask2Former)，arXiv:2112.01527。官方同架構支援 semantic、instance、panoptic，model zoo 包含 ADE20K、Cityscapes、COCO、Mapillary。
- RGB 與任務對應標註；輸出語意或單物件 mask。要單株冠界需 instance 標註，不能只有綠色二值 mask 卻聲稱單株。密接冠與小冠仍需本地驗證。
- [主程式 MIT](https://raw.githubusercontent.com/facebookresearch/Mask2Former/main/LICENSE)；README 另列 Deformable-DETR 部分 Apache-2.0、Swin 部分 MIT。個別 checkpoint 及訓練資料權利仍須確認，主程式 MIT 不是所有權重的獨立授權證明。
- [安裝文件](https://raw.githubusercontent.com/facebookresearch/Mask2Former/main/INSTALL.md) 明列 Detectron2、MSDeformAttn CUDA kernel 編譯；雖寫 Linux/macOS，不代表無 CUDA 的 Apple Silicon 原版流程已驗證可用。首輪不推薦此較重路徑。

### S5 Segment Anything（Kirillov et al.，2023；SAM v1）

- [官方 repo／checkpoint／授權](https://github.com/facebookresearch/segment-anything)，arXiv:2304.02643。本組只指 SAM v1，不混入 SAM2 條款或成效。
- RGB 加點／框提示或 automatic mask generator，輸出物件 masks、predicted IoU、stability score。官方有 ViT-B/L/H checkpoint，明列 model Apache-2.0；SA-1B dataset 是獨立 Research License，不能混稱資料集 Apache。
- **SAM 是形狀分割，不是樹木／草地分類器**。自動 masks 包括屋頂、道路、碎片與重疊物件；predicted IoU 不是本地樹冠準確率。陰影、低解析、冠相連、提示漏檢都可能出錯。
- DeepForest→SAM 只是框轉待驗 mask；要驗證提示與 mask 選擇規則，且上游漏檢限制召回，不能以自動補樹彌補。較適合作人工標註輔助後修訂。官方強烈建議 CUDA；Mac 速度／記憶體未測。

### S6 SLIC Superpixels Compared to State-of-the-art Superpixel Methods（Achanta et al.，TPAMI 2012）

- [作者 EPFL 頁](https://www.epfl.ch/labs/ivrl/research/slic-superpixels/) 核實題名、34(11):2274–2282，聯合顏色與座標聚類；SLICO 自適應 compactness。
- 輸入 RGB/Lab 與空間位置，輸出 superpixel labels，沒有預訓練權重或樹冠語意。OBIA 後續須 region 分類規則或標註學習：綠度統計、紋理、形狀、鄰接、陰影比例等。
- 限制：陰影跨界、小道路樹被吞併、分區尺度影響面積；每個 superpixel 不是一株樹，鄰近綠物件也不能無條件合併。
- 授權：EPFL 頁 executable 明寫 only for evaluation；未開壓縮檔查原碼 LICENSE，不假定可直接產品化。可另審 S7 實作，不能混同兩者授權。

### S7 scikit-image segmentation API / SLIC 官方文件

- [官方 API（slic）](https://scikit-image.org/docs/stable/api/skimage.segmentation.html#skimage.segmentation.slic) 說明 Color-(x,y,z) 空間 k-means 分區；輸入多通道影像、n_segments、compactness 等，輸出 region labels，不是植被類別，無權重。
- [官方 LICENSE](https://raw.githubusercontent.com/scikit-image/scikit-image/main/LICENSE.txt) 主要 BSD-3-Clause，另列個別 BSD-2/MIT 檔案；採用須固定版本、保留通知並核對實際檔案。
- CPU 有界 patch 實驗可評估，但目前專案無此 Python stack；本次未安裝，不能宣稱已跑通／快速。零安裝階段先用既有 Node/Canvas 做顏色、局部統計及人工檢查；SLIC 需要新依賴則列 blocked，另行核准。

### S8 臺灣作者研究：ACCURACY ASSESSMENT OF CROWN DELINEATION METHODS FOR THE INDIVIDUAL TREES USING LIDAR DATA（Chang, Lin, Lin, Liu，2016）

- [出版者原文摘要](https://isprs-archives.copernicus.org/articles/XLI-B8/585/2016/)，DOI [10.5194/isprs-archives-XLI-B8-585-2016](https://doi.org/10.5194/isprs-archives-XLI-B8-585-2016)。[作者機構紀錄](https://api.openalex.org/works/https://doi.org/10.5194/isprs-archives-xli-b8-585-2016?select=title,authorships,doi) 核實明新科大、嘉義大學、國防大學及臺灣公司作者，非只憑 Taiwan 搜尋字串認定。
- 已讀摘要：Leica ALS70-HP 高爾夫球場 LiDAR，先比 DSM−DEM 與 pit-free CHM，再以 MMAC／VWF delineation；由航空立體像對人工量測樹高／冠徑驗證。摘要不足以確認樣區在臺灣，故只稱**臺灣作者研究**，不虛構樣區。
- 需 LiDAR/CHM 及驗證像對，不是單張 PHOTO2 RGB；輸出個體樹冠參數。啟示是結構證據、CHM pits 與人工驗證重要，不能以此研究背書 RGB-only 高度或冠界。
- 出版頁顯示 CC BY 3.0（文章）；未找到／核實程式或模型權重，文章授權不代表可用模型存在。

國內檢索界線：Crossref 結果多非臺灣研究，後遇 429 即停止該服務；改 OpenAlex 限作者機構 TW 並核對出版者。另見 Bamboo Forest Area Extraction and Clump Identification Using Semantic Segmentation and Instance Segmentation Models（10.3390/f17020191），但出版者 403，未核實內容，**未納入八組證據、不引用其方法與精度**。這不是系統性回顧，也不聲稱臺灣 RGB 樹冠研究不存在。

## 顏色、陰影與 OBIA：待驗工程設計

以下為建議，不援引未核實的原始指數論文或最佳門檻：

- 以 r=R/(R+G+B)、g/b 同理，處理分母 0 後加入 ExG=2g−r−b、GLI=(2G−R−B)/(2G+R+B) 特徵，與原始門檻分開比較。閾值只由 validation 選，不看 test 調參。RGB 不可計算 NDVI。
- 加入亮度、HSV/Lab、局部變異／紋理及物件形狀，但不假設能可靠區分冠／草；綠色屋頂是必要 hard negative。不能由綠度或非綠區推論金屬屋頂材質。
- 陰影是照明狀態，不是地物：能辨識的陰影冠仍標冠，不能判讀留 unknown/ignore 並計面積。不能提亮後全補植被，也不能全當非植被。
- SLIC 多尺度、region 分類與鄰接一致性需消融。形態 opening/closing 可能刪小樹／填道路孔，需驗面積偏差，不能只選視覺漂亮圖。
- 浮水印/nodata/unknown 與真零分開；不移除原圖版權標誌、不公開原圖。分析／評分若設 watermark ignore，要報排除面積與分母。

## 有界驗證配方（尚未執行）

1. **凍結資料**：只用既有 12 張快取、不抓新瓦片。固定原始 RGB hash、瓦片座標、CRS、分析取樣、方法版本；日期/GSD 保留 unknown。保留行政界 clipping、孔洞、tile seam、EPSG:3826 面積測試。
2. **真值**：最多 48 個不重疊 128×128 區塊（12 張 tile 可切上限），先列清楚樹冠、草灌、綠／藍屋頂、道路、冠相連、深陰影、浮水印及範圍邊界。逐像素標可辨冠／其他植被／非植被／不可判讀，另記 shadow。第二人覆核至少 20% 及全部爭議，記標註時間／規則；缺某類就明說未驗。
3. **空間隔離**：先用連續地理 block 分 train/validation/test；禁相鄰重疊 crops 與同一樹冠跨 split，記緩衝區。若小樣區不足獨立 test，只稱樣區內 feasibility，不宣稱地域泛化；不得自行擴張補資料。
4. **首輪三組**：A 既有 RGB 門檻；B normalized 綠度＋陰影／unknown；C B＋物件化（需新安裝就列 blocked）。相同資料／mask／分母，保存後處理前後結果。樹冠與全部植被精度分開，避免草地命中掩蓋冠錯誤。
5. **指標**：每類 precision/recall/IoU/F1，每 block 真實／預測面積及冠覆蓋比例誤差（百分點），排除/unknown 面積；分列陰影內外、小冠、綠屋頂、tile seam。若另核准 DeepForest，框用 detection P/R/AP 及匹配 IoU；SAM/instance 用 mask IoU／instance 指標，不拿 box AP 代替像素 IoU。
6. **選擇與不確定度**：報逐 block 分布；樣本足夠才以地理 block bootstrap 做區間，不把相依像素當獨立樣本。validation 預選一候選，test 不調參；跨分層改善且無不可接受小冠／陰影退化才換基線。產品發布門檻另定，不捏造通過分數。
7. **模型進階門檻**：先取得冠 mask、覆核、實作／權重授權、環境及最大耗時／記憶體預算，再另核准小型 U-Net。DeepForest 框與人工 SAM 為分開對照。SegFormer 官方 non-commercial 條款與 Mask2Former CUDA 工程成本使它們非此 Mac／產品首選。只在現有區域本機離線，不上傳影像。
8. **交付與停損**：輸出方法比較、錯誤案例、hash/version、排除面積及 blocked items。未驗證前 UI 保留「RGB 植被候選」，冠層 unavailable，不以空集合冒充零。影像／衍生 polygon 公開權利仍按既有 NLSC 條款審查，不因模型開源就自動可散布。

## 完成範圍

已完成來源核實、輸入／輸出／授權與本機限制分析及驗證設計；僅新增本文件。沒有模型下載、套件安裝、測速、訓練、地域擴張、真值建立、實測精度、提交或部署。本研究不使現有顏色門檻成為已驗證樹冠演算法。
