/**
 * 共享抓取工具函数
 * 供 clip/fetch 和 fetch-page 等 API 路由复用。
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import dns from "dns";

import { extractContent, FALLBACK_STATUS_CODES, MIN_CONTENT_LENGTH, type ExtractResult } from "./content-extractor";
import { scrapePageHtml } from "./scraper";

// ====== 配置 ======

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_IMAGES = 30;
const DL_TIMEOUT = 15000;

// ====== 图片处理 ======

function guessImageExt(imgUrl: string): string {
  try {
    const u = new URL(imgUrl);
    const m = u.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i);
    if (m) return m[0].toLowerCase();
    const wx = u.searchParams.get("wx_fmt");
    if (wx && ["jpg", "jpeg", "png", "gif", "webp", "bmp", "ico"].includes(wx)) {
      return "." + wx;
    }
    const seg = u.pathname.split("/").pop() || "";
    const segm = seg.match(/\.?(jpg|jpeg|png|gif|webp|svg|bmp|ico)/i);
    if (segm) return "." + segm[1].toLowerCase();
  } catch {
    // ignore
  }
  return ".jpg";
}

export async function downloadImage(
  imgUrl: string,
  referer?: string
): Promise<{ localUrl: string; originalUrl: string } | null> {
  try {
    // SSRF 防护：跳过内网/保留地址的图片（页面 img src 可能为内网地址）。
    // 升级为含 DNS 二次校验的异步版本，拦截「域名 → 内网 IP」的 DNS 重绑定绕过。
    try {
      await assertUrlNotPrivate(imgUrl);
    } catch {
      return null;
    }
    const headers: Record<string, string> = {
      "User-Agent": UA,
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    };
    if (referer) headers["Referer"] = referer;

    const resp = await fetch(imgUrl, {
      headers,
      signal: AbortSignal.timeout(DL_TIMEOUT),
      redirect: "follow",
    });
    if (!resp.ok) return null;

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 100) return null;

    const ct = resp.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;

    const ext = guessImageExt(imgUrl);
    const filename = crypto.randomBytes(12).toString("hex") + ext;
    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(path.join(UPLOADS_DIR, filename), buffer);

    return { localUrl: "/uploads/" + filename, originalUrl: imgUrl };
  } catch {
    return null;
  }
}

export async function downloadAllImages(
  urls: string[],
  referer?: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const seen = new Set<string>();

  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    if (map.size >= MAX_IMAGES) break;

    const result = await downloadImage(u, referer);
    if (result) map.set(result.originalUrl, result.localUrl);
  }

  return map;
}

/**
 * 判断一个 URL 是否为网站首页（根路径）
 */
export function isHomepageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    return path === "" || path === "/index.html" || path === "/index.htm";
  } catch {
    return false;
  }
}

// ====== SSRF 防护 ======

/**
 * 判断主机名是否指向内网/保留地址（IP 字面量）。
 * 覆盖 localhost、127/8、10/8、172.16/12、192.168/16、169.254/16（含云元数据）、
 * 0.0.0.0、::1、fc00::/7、fe80::/10 等。
 * 注意：域名需配合 assertUrlNotPrivate 做 DNS 二次校验。
 */
export function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  // 去掉 IPv6 方括号
  const bare = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  if (bare === "::1" || bare === "::" || bare === "0.0.0.0") return true;
  // IPv6 私有/链路本地 (fc00::/7, fe80::/10)
  if (bare.startsWith("fc") || bare.startsWith("fd")) return true;
  if (
    bare.startsWith("fe8") || bare.startsWith("fe9") || bare.startsWith("fea") ||
    bare.startsWith("feb") || bare.startsWith("fec") || bare.startsWith("fed")
  ) return true;
  // IPv4 字面量
  const m = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 127) return true;                        // 127.0.0.0/8
    if (a === 10) return true;                         // 10.0.0.0/8
    if (a === 0) return true;                          // 0.0.0.0/8
    if (a === 169 && b === 254) return true;           // 169.254.0.0/16（含云元数据 169.254.169.254）
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;           // 192.168.0.0/16
    return false;
  }
  // 非 IP 字面量（域名）：返回 false，交由 assertUrlNotPrivate 做 DNS 解析判断
  return false;
}

/**
 * 判断完整 URL 是否应被拒绝：非 http(s) 协议、解析失败、或主机指向内网/保留地址。
 */
export function isPrivateUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return true;
    return isPrivateHostname(u.hostname);
  } catch {
    return true; // 解析失败按不可信处理
  }
}

/**
 * 异步 SSRF 校验：在 isPrivateUrl 基础上对域名做 DNS 解析后二次校验，
 * 拦截「域名 → 内网 IP」的绕过。DNS 解析失败时不阻断（避免误杀正常域名）。
 */
export async function assertUrlNotPrivate(url: string): Promise<void> {
  if (isPrivateUrl(url)) throw new Error("禁止访问内网/保留地址");
  try {
    const hostname = new URL(url).hostname;
    const { address } = await dns.promises.lookup(hostname);
    if (isPrivateHostname(address)) throw new Error("禁止访问内网/保留地址");
  } catch (e) {
    if (e instanceof Error && e.message.includes("禁止")) throw e;
    // 其他错误（DNS 失败等）放行
  }
}

/**
 * 仅拦截最敏感的内部地址：loopback（127/8、::1）与云元数据（169.254.169.254）。
 * 用于允许用户配置局域网 AI 服务（如 192.168.x.x 的 ollama）的场景——
 * 此时不应一刀切拦截全部私有网段，只挡「本机」和「云元数据」这类绝对危险的地址。
 */
export function isSensitiveInternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return true;
    const h = u.hostname.toLowerCase().trim();
    if (h === "localhost" || h.endsWith(".localhost")) return true;
    const bare = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
    if (bare === "::1" || bare === "127.0.0.1" || bare === "0.0.0.0") return true;
    const m = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
      const a = +m[1], b = +m[2];
      if (a === 127) return true;                        // 127.0.0.0/8
      if (a === 169 && b === 254) return true;          // 169.254.0.0/16 云元数据
    }
    return false;
  } catch {
    return true;
  }
}

// ====== 统一抓取 + 提取编排（fetchAndExtract） ======

/**
 * 将提取结果中的图片下载到本地并替换 contentHtml 中的 src。
 *
 * 采用 cheerio 在 HTML 上下文内替换，避免「contentHtml 中 src 被 HTML 转义
 * （如 & → &amp;）导致字符串替换不匹配」的问题。
 *
 * 容错：下载失败则保留远程 URL（map 中无该 key），不影响主流程。
 * 腾讯云等站点的图片若被热链拦截，本轮作为已知限制先返回远程 URL。
 */
async function localizeImages(
  result: ExtractResult,
  referer: string
): Promise<ExtractResult> {
  if (!result.imgUrls || result.imgUrls.length === 0) return result;

  const map = await downloadAllImages(result.imgUrls, referer);
  if (map.size === 0) return result;

  const cheerio = await import("cheerio");
  const $ = cheerio.load(result.contentHtml || "");
  $("img").each((_: number, el: any) => {
    const $el = $(el);
    const src = $el.attr("src") || "";
    const local = map.get(src);
    if (local) $el.attr("src", local);
  });

  return { ...result, contentHtml: $.html() };
}

/**
 * 统一抓取 + 提取编排。
 *
 * 流程：
 * 1. 先 fetch(url)（带 UA / Cookie / Referer）→ 取 HTML → extractContent。
 * 2. 若响应状态码命中 FALLBACK_STATUS_CODES，或提取文本长度 < MIN_CONTENT_LENGTH，
 *    则调用 scrapePageHtml(url)（浏览器兜底，仅一次）→ 再 extractContent。
 * 3. 兜底仍失败则抛出异常（由调用方决定返回错误）。
 * 4. 图片非阻塞/容错下载到本地并替换 src（失败保留远程 URL）。
 *
 * @returns ExtractResult 附带 source 字段，标识内容来自 'http' 还是 'browser' 兜底。
 */
export async function fetchAndExtract(
  url: string,
  cookie?: string
): Promise<ExtractResult & { source: "http" | "browser" }> {
  // SSRF 防护（含 DNS 二次校验）：拦截「域名 → 内网 IP」的 DNS 重绑定绕过。
  // 放在 try 之前，确保任何内网/保留地址立即失败，不走浏览器兜底。
  try {
    await assertUrlNotPrivate(url);
  } catch {
    throw new Error("禁止访问内网/保留地址");
  }

  const referer = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return url;
    }
  })();

  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  };
  if (cookie) headers["Cookie"] = cookie;

  // ===== HTTP 路径 =====
  try {
    const resp = await fetch(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    const status = resp.status;
    if (!resp.ok || FALLBACK_STATUS_CODES.includes(status)) {
      throw new Error(`http_status:${status}`);
    }

    const html = await resp.text();

    // 知乎（专栏/回答）SSR 仅返回摘要，必须走浏览器 JS 渲染才能拿到全文，
    // 否则会被误判为「内容足够」而返回截断的摘要。强制走浏览器兜底。
    if (url.includes('zhihu.com')) {
      throw new Error('zhihu_force_browser');
    }

    // 腾讯云开发者社区（Next.js SSR）文章页正文由客户端 JS 渲染，
    // 服务端 HTML 中 mod-content__markdown 为空。若检测到空容器则强制走浏览器。
    if (url.includes('cloud.tencent.com/developer/article/')) {
      const emptyMarker = '<div class="mod-content__markdown"></div>';
      if (html.includes(emptyMarker)) {
        throw new Error('tencent_cloud_ssr_force_browser');
      }
    }

    const result = await extractContent(html, url);
    if (result.text.length >= MIN_CONTENT_LENGTH) {
      const localized = await localizeImages(result, referer);
      return { ...localized, source: "http" };
    }
    throw new Error("content_too_short");
  } catch (err: any) {
    const reason = err?.message || String(err);
    console.log("[fetch-utils] HTTP 路径失败（%s），转浏览器兜底：%s", reason, url);

    // ===== 浏览器兜底（仅一次） =====
    const sr = await scrapePageHtml(url, cookie);
    if (!sr.success || !sr.pageHtml) {
      throw new Error(
        "浏览器兜底失败：" + (sr.error || "未能获取渲染后的页面 HTML")
      );
    }

    const result = await extractContent(sr.pageHtml, url);
    const localized = await localizeImages(result, referer);
    return { ...localized, source: "browser" };
  }
}
