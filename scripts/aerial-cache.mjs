import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

const run = promisify(execFile);
const layers = new Set(['PHOTO2', 'PHOTO2022', 'PHOTO2023', 'PHOTO2024', 'PHOTO2025']);

export function parseTilePath(url) {
  const match = /^\/__aerial-cache\/(PHOTO\d+)\/(\d{1,2})\/(\d{1,6})\/(\d{1,6})(?:\?.*)?$/.exec(url);
  if (!match || !layers.has(match[1])) return null;
  const [, layer, zoom, row, column] = match;
  const z = Number(zoom), y = Number(row), x = Number(column);
  if (z > 19 || x >= 2 ** z || y >= 2 ** z) return null;
  return { layer, z, y, x };
}

function contentType(bytes) {
  if (bytes.length > 24 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png';
  if (bytes.length > 24 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  throw new Error('官方回應不是 PNG 或 JPEG，未寫入影像快取。');
}

async function downloadTile(url) {
  const { stdout } = await run('curl', ['--fail', '--location', '--proto', '=https', '--proto-redir', '=https',
    '--silent', '--show-error', '--connect-timeout', '10', '--max-time', '30', url],
  { encoding: 'buffer', maxBuffer: 2 * 1024 * 1024 });
  return stdout;
}

export function createAerialCache({ directory, offline = false, download = downloadTile }) {
  const pending = new Map();
  async function load(tile) {
    const { layer, z, y, x } = tile;
    const basename = path.join(directory, layer, String(z), String(y), String(x));
    for (const extension of ['.jpg', '.png']) {
      try {
        const bytes = await readFile(`${basename}${extension}`);
        return { bytes, contentType: contentType(bytes), cache: 'HIT' };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    if (offline) throw new Error('此圖磚尚未下載；離線模式不會請求官方服務。');
    const url = `https://wmts.nlsc.gov.tw/wmts/${layer}/default/GoogleMapsCompatible/${z}/${y}/${x}`;
    const bytes = await download(url);
    const type = contentType(bytes);
    const filename = `${basename}${type === 'image/png' ? '.png' : '.jpg'}`;
    await mkdir(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, bytes);
      await writeFile(`${temporary}.json`, JSON.stringify({ source: url, downloadedAt: new Date().toISOString(),
        layer, zoom: z, row: y, column: x, tileMatrix: 'GoogleMapsCompatible', crs: 'EPSG:3857',
        contentType: type, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
        captureDate: null, note: '年度為圖層版本，非實際拍攝日期；保留原始圖磚內容與浮水印' }, null, 2) + '\n');
      await rename(`${temporary}.json`, `${filename}.json`);
      await rename(temporary, filename);
    } finally {
      await Promise.all([rm(temporary, { force: true }), rm(`${temporary}.json`, { force: true })]);
    }
    return { bytes, contentType: type, cache: 'MISS' };
  }
  return {
    get(url) {
      const tile = parseTilePath(url);
      if (!tile) return Promise.reject(new Error('不支援的航照圖磚路徑。'));
      const key = `${tile.layer}/${tile.z}/${tile.y}/${tile.x}`;
      if (!pending.has(key)) {
        const task = load(tile).finally(() => pending.delete(key));
        pending.set(key, task);
      }
      return pending.get(key);
    },
  };
}

export function aerialCachePlugin({ directory, offline = false }) {
  return {
    name: 'local-aerial-analysis-cache', apply: 'serve',
    configureServer(server) {
      const cache = createAerialCache({ directory, offline });
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/__aerial-cache/')) return next();
        if (req.method !== 'GET' || !parseTilePath(req.url)) {
          res.statusCode = 400;
          res.end('Invalid aerial tile request');
          return;
        }
        cache.get(req.url).then(result => {
          res.setHeader('Content-Type', result.contentType);
          res.setHeader('Cache-Control', 'private, max-age=86400');
          res.setHeader('X-Aerial-Cache', result.cache);
          res.end(result.bytes);
        }).catch(() => {
          // Keep failed/missing tiles retryable and never expose local paths or child-process errors.
          server.config.logger.warn(`航照快取載入失敗：${parseTilePath(req.url)?.layer}；${offline ? '離線缺圖' : '請檢查來源服務或本機檔案權限'}`);
          res.statusCode = 502;
          res.setHeader('Cache-Control', 'no-store');
          res.end(offline ? 'Tile not available offline' : 'Aerial tile unavailable');
        });
      });
    },
  };
}
