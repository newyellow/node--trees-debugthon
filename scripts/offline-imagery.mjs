import { readFile, writeFile, mkdir, stat, copyFile, rename, open } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'data/offline-imagery');
const official = 'https://maps.nlsc.gov.tw/T09/mapshow.action?In_type=web&showOm=true';

export function tileRange(bbox, zoom) {
  const n = 2 ** zoom;
  const x = lng => Math.floor((lng + 180) / 360 * n);
  const y = lat => Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  const minX = x(bbox[0]), maxX = x(bbox[2]), minY = y(bbox[3]), maxY = y(bbox[1]);
  return { zoom, minX, maxX, minY, maxY, tiles: (maxX - minX + 1) * (maxY - minY + 1) };
}

export function imagePackageType(bytes) {
  if (bytes.subarray(0, 16).toString() === 'SQLite format 3\0') return '.mbtiles';
  if (['504b0304', '504b0506', '504b0708'].includes(bytes.subarray(0, 4).toString('hex'))) return '.zip';
  if (['49492a00', '4d4d002a', '49492b00', '4d4d002b'].includes(bytes.subarray(0, 4).toString('hex'))) return '.tif';
  throw new Error('檔案不是 SQLite/MBTiles、ZIP 或 TIFF；可能是錯誤頁或過期的下載連結。');
}

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function inspect(file) {
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(16);
    await handle.read(buffer, 0, 16, 0);
    return { extension: imagePackageType(buffer), bytes: (await handle.stat()).size, sha256: await digest(file) };
  } finally { await handle.close(); }
}

async function plan() {
  const regions = JSON.parse(await readFile(path.join(root, 'public/data/regions.json'), 'utf8'));
  if (regions.districts?.length !== 12) throw new Error('需要完整的臺北市 12 區邊界，請先執行 npm run boundaries:refresh。');
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const feature of regions.districts) {
    bbox[0] = Math.min(bbox[0], feature.bbox[0]); bbox[1] = Math.min(bbox[1], feature.bbox[1]);
    bbox[2] = Math.max(bbox[2], feature.bbox[2]); bbox[3] = Math.max(bbox[3], feature.bbox[3]);
  }
  const levels = [16, 17, 18, 19].map(z => tileRange(bbox, z));
  const tileCount = levels.reduce((sum, row) => sum + row.tiles, 0);
  const latitude = (bbox[1] + bbox[3]) / 2;
  const request = {
    generatedAt: new Date().toISOString(), status: 'awaiting-official-package',
    scope: '臺北市全市（含山區），使用 12 區實際邊界作後續分析遮罩',
    bboxCrs: 'EPSG:4326', bbox, boundarySource: regions.source,
    desiredYears: [2022, 2023, 2024, 2025],
    requestedProduct: '高解析度 RGB 正射影像；優先原始 GeoTIFF 及拍攝日期，替代格式 MBTiles',
    desiredGroundResolutionMetres: '0.1–0.3（需求值，尚未確認供應；不得將圖磚顯示尺度當作原始解析度）',
    offlineService: official, offlineServiceYearSelection: '目前表單未提供歷史年度選項，需另外確認年度供應',
    offlineServiceMaxZoom: 19, offlineServiceLevels: [16, 17, 18, 19],
    displayMetresPerPixelAtZoom19: 156543.03392804097 * Math.cos(latitude * Math.PI / 180) / 2 ** 19,
    estimate: { method: '全市外接矩形；包括市界外圖磚，並非實際市界內精確數量', levels,
      tilesPerPackage16to19: tileCount, assumedTileBytes: [20000, 80000],
      estimatedGiBPerPackage: [20000, 80000].map(size => +(tileCount * size / 2 ** 30).toFixed(2)),
      note: '僅為假設每磚 20–80 KB 的規劃範圍，未抽樣測量；不含容器、索引與原始 GeoTIFF，實際以供應檔案為準' },
    purpose: 'Trees Debugthon：僅團隊內部離線樹冠辨識、樹木資料交叉比對及年度變化分析，不公開散布影像、不作公開圖磚服務。',
    requiredMetadata: ['實際拍攝日期或分區日期索引', '原始地面解析度', '坐標參考系統', '涵蓋範圍與缺漏區', '下載、離線分析及衍生成果之使用條件'],
  };
  await writeFile(path.join(directory, 'request.json'), JSON.stringify(request, null, 2) + '\n');
  await writeFile(path.join(directory, 'taipei-boundary.geojson'), JSON.stringify({ type: 'FeatureCollection', bbox, features: regions.districts }) + '\n');
  const text = `# 全臺北離線影像申請規格\n\n狀態：尚待申請核准及下載，未取得影像。\n\n官方離線申請：${official}\n\n1. 系統功能 → 離線地圖申請 → MBTiles。\n2. 種類選「臺灣通用正射影像」，使用最高第 19 層、僅框選範圍 16–19 層；不需全臺低階底圖。\n3. 框選全臺北；WGS84 外接矩形（西、南、東、北）：${bbox.map(n => n.toFixed(7)).join(', ')}。若超過官方範圍限制，依附帶的 12 區邊界分批申請，勿漏山區。\n4. 填寫本人姓名、電話、Email、用途及實際使用人數，依 Email 驗證流程申請。申請核准後才會寄下載網址。\n5. 目前表單無年度選單；2022–2025 個別年度請另外向供應單位確認，不能把最新拼接包標為 2025 拍攝。\n\n用途（可複製）：${request.purpose}\n\n樹冠分析需求：優先有地理定位的原始 GeoTIFF、原始地面解析度 10–30 公分；這是需求值，尚未確認可取得。請一併提供實際拍攝日期、分區日期索引及使用條件。MBTiles 為已渲染 RGB 拼接影像，不含近紅外線，不適合直接計算 NDVI。\n\n容量估算：外接矩形 16–19 層共 ${tileCount.toLocaleString('en-US')} 磚／份；假設每磚 20–80 KB，約 ${request.estimate.estimatedGiBPerPackage.join('–')} GiB／份，四份年度包約 ${request.estimate.estimatedGiBPerPackage.map(n => (n * 4).toFixed(2)).join('–')} GiB。這是估算，尚非已下載容量。第 19 層顯示尺度約 ${(request.displayMetresPerPixelAtZoom19 * 100).toFixed(1)} 公分／像素，不代表原始影像解析度。\n`;
  await writeFile(path.join(directory, 'request.md'), text);
  console.log(text);
}

async function acquire(command, args) {
  const year = args.get('year') ?? 'latest';
  if (!['latest', '2022', '2023', '2024', '2025'].includes(year)) throw new Error('--year 僅可為 latest、2022–2025；年度是產品版本，非拍攝年份。');
  const part = args.get('part') ?? 'taipei';
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(part)) throw new Error('--part 請用 1–64 位小寫英文、數字、底線或連字號，作為分包識別。');
  const file = args.get('file');
  const url = process.env.IMAGERY_DOWNLOAD_URL;
  if (command === 'import' && !file) throw new Error('請指定 --file /path/to/package.mbtiles（也支援 ZIP、TIFF）。');
  let sourceUrl;
  if (command === 'download') {
    if (!url) throw new Error('請用 IMAGERY_DOWNLOAD_URL 環境變數提供官方核准後的檔案下載網址。');
    sourceUrl = new URL(url);
    if (sourceUrl.protocol !== 'https:' || sourceUrl.username || sourceUrl.password) throw new Error('下載網址必須是 HTTPS，且不得內含帳號密碼。');
  }
  const destination = path.join(directory, year, part);
  await mkdir(destination, { recursive: true });
  const metadataFile = path.join(destination, 'manifest.json');
  const sourceKey = command === 'download' ? createHash('sha256').update(url).digest('hex') : null;
  let previous;
  try { previous = JSON.parse(await readFile(metadataFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous) {
    const existing = await inspect(path.join(destination, previous.file));
    if (existing.sha256 !== previous.sha256) throw new Error('既有影像雜湊不符；保留檔案，請檢查損壞原因。');
    const same = command === 'download' ? previous.sourceKey === sourceKey : (await digest(path.resolve(file))) === previous.sha256;
    if (!same) throw new Error('此年度已有不同來源的影像，已保留原檔。請另行保存新版本，勿直接覆蓋。');
    console.log(`已存在且 SHA-256 正確，跳過：${previous.file}`);
    return;
  }
  const temporary = path.join(destination, 'source.part');
  if (command === 'download') {
    const identity = path.join(destination, 'source-key.txt');
    let oldKey;
    try { oldKey = await readFile(identity, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (oldKey && oldKey !== sourceKey) throw new Error('未完成下載的來源不同，請先另存原有 source.part，避免混合不同檔案。');
    await writeFile(identity, sourceKey);
    // One official package, sequential, resume partial transfer. Never enumerate live WMTS tiles.
    try {
      execFileSync('curl', ['--fail', '--location', '--proto', '=https', '--proto-redir', '=https', '--show-error', '--retry', '2', '--connect-timeout', '30', '--continue-at', '-', '--output', temporary, url], { stdio: 'inherit' });
    } catch {
      throw new Error('下載未完成，已保留 source.part 供續傳；請檢查官方連結是否有效、伺服器是否支援續傳。');
    }
  } else {
    await stat(path.resolve(file));
    await copyFile(path.resolve(file), temporary);
  }
  const info = await inspect(temporary);
  const filename = `source${info.extension}`;
  // Refuse to replace a package that may have been saved before a manifest write failed.
  try {
    await stat(path.join(destination, filename));
    throw new Error('來源檔已存在但沒有 manifest，請先保留並檢查該檔案。');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await rename(temporary, path.join(destination, filename));
  await writeFile(metadataFile, JSON.stringify({ version: year, part, captureDate: null, nativeGroundResolutionMetres: null,
    acquiredAt: new Date().toISOString(), source: command === 'download' ? sourceUrl.origin : 'local-import', sourceKey,
    file: filename, ...info, validation: '檔頭格式與 SHA-256；不代表涵蓋範圍、影像品質或 MBTiles 結構已驗證',
    usage: '僅供團隊離線分析，依供應單位核准條件使用；不隨網站發布' }, null, 2) + '\n');
  console.log(`已保存 ${year}/${part}/${filename}（${(info.bytes / 2 ** 20).toFixed(1)} MiB），SHA-256：${info.sha256}`);
}

async function main() {
  const [command = 'plan', ...options] = process.argv.slice(2);
  if (!['plan', 'import', 'download'].includes(command)) throw new Error('用法：plan | import --file PATH [--year latest] | download [--year latest]');
  const args = new Map();
  for (let i = 0; i < options.length; i += 2) {
    if (!['--file', '--year', '--part'].includes(options[i]) || !options[i + 1] || options[i + 1].startsWith('--')) throw new Error('無效或缺少參數；只支援 --file、--year 和 --part。');
    args.set(options[i].slice(2), options[i + 1]);
  }
  await mkdir(directory, { recursive: true });
  if (command === 'plan') await plan();
  else await acquire(command, args);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
