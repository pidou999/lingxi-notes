import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

// ====== 配置 ======

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_IMAGES = 30;
const DL_TIMEOUT = 15000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

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
  } catch {}
  return ".jpg";
}

async function downloadImage(
  imgUrl: string,
  referer?: string
): Promise<{ localUrl: string; originalUrl: string } | null> {
  try {
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

async function downloadAllImages(
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

// ====== 微信公众号文章抓取 ======

async function fetchWechat(url: string): Promise<{
  title: string;
  contentMd: string;
} | null> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
  });
  if (!resp.ok) return null;
  const html = await resp.text();

  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  // 检查是否被拦截（失效文章）
  if ($(".weui-msg__title").length > 0) return null;

  // 提取标题
  let title =
    $('meta[property="og:title"]').attr("content") || "";
  if (!title) title = $("h1.rich_media_title").text().trim();
  if (!title) title = $("title").text().trim();

  // 提取正文（微信公众号文章放在 #js_content 里）
  const contentEl = $("#js_content");
  if (!contentEl.length) return null;

  // ========== 1. 提取所有图片 URL ==========
  const imgUrls: string[] = [];
  contentEl.find("img").each((_: number, el: any) => {
    const src = $(el).attr("data-src") || $(el).attr("src") || "";
    if (src && src.startsWith("http") && !src.startsWith("data:")) {
      imgUrls.push(src);
    }
  });

  // ========== 2. 下载所有图片 ==========
  const urlMap = await downloadAllImages(imgUrls, "https://mp.weixin.qq.com/");

  // ========== 3. 在 HTML 中替换图片地址 ==========
  contentEl.find("img").each((_: number, el: any) => {
    const $el = $(el);
    const original = $el.attr("data-src") || $el.attr("src") || "";
    const local = urlMap.get(original);
    if (local) {
      // 替换 src 为本地地址
      $el.attr("src", local);
      // 移除 data-src 和 data-* 属性，避免 turndown 混淆
      const attrs = ($el[0] as any).attribs || {};
      for (const key of Object.keys(attrs)) {
        if (key.startsWith("data-")) $el.removeAttr(key);
      }
    }
  });

  // 移除干扰元素
  contentEl.find("script, style, svg, button, canvas, iframe").remove();

  // ========== 4. HTML → Markdown ==========
  const Turndown = (await import("turndown")).default;
  const td = new Turndown({
    headingStyle: "atx",
    linkStyle: "inlined",
    codeBlockStyle: "fenced",
  });

  // 自定义图片规则：data-src 优先（给没被替换的图片用）
  td.addRule("images", {
    filter: "img",
    replacement: (_content: string, node: any) => {
      const src = node.getAttribute("data-src") || node.getAttribute("src") || "";
      const alt = node.getAttribute("alt") || "图片";
      if (!src || src.startsWith("data:")) return "";
      return `![${alt}](${src})`;
    },
  });

  // 自定义链接规则：不要自动添加 title/rel
  td.addRule("links", {
    filter: "a",
    replacement: (content: string, node: any) => {
      const href = node.getAttribute("href") || "";
      if (!href || href.startsWith("javascript:") || href === "#") return content;
      return `[${content}](${href})`;
    },
  });

  const contentHtml = contentEl.html() || "";
  let contentMd = td.turndown(contentHtml);

  // ========== 5. 后处理清理 ==========
  contentMd = contentMd
    // 清理多余的空行
    .replace(/\n{4,}/g, "\n\n\n")
    // 清理尾部冗余图片说明（如 "文章图片"、"图片" 等）
    .replace(/[（(]?(?:文章)?图片[）)]?\n*$/, "")
    .trim();

  // 添加元信息
  const author = $("a#js_name").text().trim();
  const metaParts: string[] = [];
  if (author) metaParts.push(`**作者**：${author}`);
  metaParts.push(`**来源**：微信公众号`);
  metaParts.push(`**原文**：[${url}](${url})`);

  contentMd = `${metaParts.join("\n")}\n\n---\n\n${contentMd}`;

  return { title, contentMd };
}

// ====== 知乎文章抓取（需要 Cookie） ======

async function fetchZhihu(
  url: string,
  cookie?: string
): Promise<{
  title: string;
  contentMd: string;
} | null> {
  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  };
  if (cookie) {
    headers["Cookie"] = cookie;
  }

  const resp = await fetch(url, { headers });
  if (!resp.ok) return null;
  const html = await resp.text();

  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  // 提取标题
  let title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="title"]').attr("content") ||
    $("title").text().trim() ||
    "";

  // 提取正文
  let contentEl = $(".RichText").first();
  if (!contentEl.length) contentEl = $(".Post-RichText").first();
  if (!contentEl.length) contentEl = $('article').first();
  if (!contentEl.length) contentEl = $('[role="main"]').first();

  if (!contentEl.length) return null;

  // 提取并下载图片
  const imgUrls: string[] = [];
  contentEl.find("img").each((_: number, el: any) => {
    const src =
      $(el).attr("data-actualsrc") ||
      $(el).attr("data-original") ||
      $(el).attr("src") ||
      "";
    if (src && src.startsWith("http") && !src.startsWith("data:")) {
      imgUrls.push(src);
    }
  });

  const urlMap = await downloadAllImages(imgUrls, url);

  // 替换图片地址
  contentEl.find("img").each((_: number, el: any) => {
    const $el = $(el);
    const original =
      $el.attr("data-actualsrc") ||
      $el.attr("data-original") ||
      $el.attr("src") ||
      "";
    const local = urlMap.get(original);
    if (local) {
      $el.attr("src", local);
      ["data-actualsrc", "data-original", "data-size", "data-caption"].forEach(
        (a) => $el.removeAttr(a)
      );
    }
  });

  contentEl
    .find(
      "script, style, svg, button, canvas, iframe, nav, footer, aside, meta, link"
    )
    .remove();

  const Turndown = (await import("turndown")).default;
  const td = new Turndown({
    headingStyle: "atx",
    linkStyle: "inlined",
    codeBlockStyle: "fenced",
  });

  td.addRule("images", {
    filter: "img",
    replacement: (_content: string, node: any) => {
      const src = node.getAttribute("src") || "";
      const alt = node.getAttribute("alt") || "图片";
      if (!src || src.startsWith("data:")) return "";
      return `![${alt}](${src})`;
    },
  });

  td.addRule("links", {
    filter: "a",
    replacement: (content: string, node: any) => {
      const href = node.getAttribute("href") || "";
      if (!href || href.startsWith("javascript:") || href === "#")
        return content;
      return `[${content}](${href})`;
    },
  });

  const contentHtml = contentEl.html() || "";
  let contentMd = td.turndown(contentHtml);
  contentMd = contentMd.replace(/\n{4,}/g, "\n\n\n").trim();

  if (!contentMd || contentMd.length < 20) return null;

  // 添加元信息
  const author =
    $('.AuthorInfo-name .ProfileLink').first().text().trim() ||
    $('meta[name="author"]').attr("content") ||
    "";
  const metaParts: string[] = [];
  if (author) metaParts.push(`**作者**：${author}`);
  metaParts.push(`**来源**：知乎`);
  metaParts.push(`**原文**：[${url}](${url})`);

  contentMd = `${metaParts.join("\n")}\n\n---\n\n${contentMd}`;

  return { title, contentMd };
}

// ====== 通用站点抓取（fallback） ======

async function fetchGeneric(url: string): Promise<{
  title: string;
  contentMd: string;
} | null> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
  });
  if (!resp.ok) return null;
  const html = await resp.text();

  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  // 提取标题
  let title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="title"]').attr("content") ||
    $("title").text().trim() ||
    "";

  // 提取主要内容：优先 article / [role=main] / .post-content / #content / body
  let contentEl = $("article").first();
  if (!contentEl.length) contentEl = $('[role="main"]').first();
  if (!contentEl.length) contentEl = $(".post-content, .article-content, #content, .content").first();

  // 如果还是没找到，用 body
  if (!contentEl.length) contentEl = $("body");

  // 提取图片（优先 data-src，再 src）
  const imgUrls: string[] = [];
  contentEl.find("img").each((_: number, el: any) => {
    const src = $(el).attr("data-src") || $(el).attr("src") || "";
    if (src && src.startsWith("http") && !src.startsWith("data:")) {
      imgUrls.push(src);
    }
  });

  const urlMap = await downloadAllImages(imgUrls);

  // 替换图片地址
  contentEl.find("img").each((_: number, el: any) => {
    const $el = $(el);
    const original = $el.attr("data-src") || $el.attr("src") || "";
    const local = urlMap.get(original);
    if (local) {
      $el.attr("src", local);
      const attrs = ($el[0] as any).attribs || {};
      for (const key of Object.keys(attrs)) {
        if (key.startsWith("data-")) $el.removeAttr(key);
      }
    }
  });

  contentEl.find("script, style, svg, button, canvas, iframe, nav, footer, aside").remove();

  // 转换为 Markdown
  const Turndown = (await import("turndown")).default;
  const td = new Turndown({
    headingStyle: "atx",
    linkStyle: "inlined",
    codeBlockStyle: "fenced",
  });

  td.addRule("images", {
    filter: "img",
    replacement: (_content: string, node: any) => {
      const src = node.getAttribute("data-src") || node.getAttribute("src") || "";
      const alt = node.getAttribute("alt") || "图片";
      if (!src || src.startsWith("data:")) return "";
      return `![${alt}](${src})`;
    },
  });

  td.addRule("links", {
    filter: "a",
    replacement: (content: string, node: any) => {
      const href = node.getAttribute("href") || "";
      if (!href || href.startsWith("javascript:") || href === "#") return content;
      return `[${content}](${href})`;
    },
  });

  const contentHtml = contentEl.html() || "";
  let contentMd = td.turndown(contentHtml);
  contentMd = contentMd.replace(/\n{4,}/g, "\n\n\n").trim();

  if (!contentMd || contentMd.length < 20) return null;

  return { title, contentMd };
}

// ====== 主入口 ======

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const cookie = typeof body.cookie === "string" ? body.cookie : undefined;

    if (!url) {
      return NextResponse.json(
        { success: false, error: "请输入文章链接" },
        { status: 400 }
      );
    }

    let result: { title: string; contentMd: string } | null = null;

    // ===== 微信 =====
    if (url.includes("mp.weixin.qq.com") || url.includes("weixin.qq.com")) {
      result = await fetchWechat(url);
      if (!result) {
        return NextResponse.json({
          success: false,
          error: "无法抓取该微信文章，可能已失效或需要登录",
        });
      }
    }
    // ===== 知乎 =====
    else if (
      url.includes("zhuanlan.zhihu.com") ||
      url.includes("zhihu.com")
    ) {
      result = await fetchZhihu(url, cookie);
      if (!result) {
        if (!cookie) {
          return NextResponse.json({
            success: false,
            error: "抓取知乎需要配置 Cookie，请前往 设置 → 抓取配置 添加 zhihu.com 的 Cookie",
          });
        }
        return NextResponse.json({
          success: false,
          error: "无法抓取该知乎文章，Cookie 可能已过期，请更新后重试",
        });
      }
    } else {
      // ===== 通用站点 =====
      result = await fetchGeneric(url);
    }

    if (!result) {
      return NextResponse.json({
        success: false,
        error: "无法从该页面提取内容，暂不支持该网站",
      });
    }

    return NextResponse.json({
      success: true,
      title: result.title,
      content: result.contentMd,
      url,
    });
  } catch (err: any) {
    console.error("[clip/fetch] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "抓取失败" },
      { status: 500 }
    );
  }
}
