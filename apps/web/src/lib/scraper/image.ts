/**
 * 图片下载模块
 *
 * 将远程图片下载到本地 public/uploads/ 目录。
 */
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { DESKTOP_UA, DL_TIMEOUT, MAX_IMAGES } from './browser';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

function guessImageExt(imgUrl: string): string {
  try {
    const u = new URL(imgUrl);
    const m = u.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i);
    if (m) return m[0].toLowerCase();
    const wx = u.searchParams.get('wx_fmt');
    if (wx && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico'].includes(wx)) return '.' + wx;
  } catch {}
  return '.jpg';
}

/**
 * 将远程图片下载到本地，返回 url→localUrl 映射表。
 */
export async function downloadImages(
  urls: string[],
  referer?: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const seen = new Set<string>();

  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    if (map.size >= MAX_IMAGES) break;

    try {
      const headers: Record<string, string> = {
        'User-Agent': DESKTOP_UA,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      };
      if (referer) headers['Referer'] = referer;

      const resp = await fetch(u, {
        headers,
        signal: AbortSignal.timeout(DL_TIMEOUT),
        redirect: 'follow',
      });
      if (!resp.ok) continue;
      const buffer = Buffer.from(await resp.arrayBuffer());
      if (buffer.length < 100) continue;

      const ext = guessImageExt(u);
      const filename = crypto.randomBytes(12).toString('hex') + ext;
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);
      map.set(u, '/uploads/' + filename);
    } catch {
      // skip failed images
    }
  }
  return map;
}
