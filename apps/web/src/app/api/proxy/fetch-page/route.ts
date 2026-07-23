import { NextRequest, NextResponse } from "next/server";
import { isHomepageUrl, isPrivateUrl, assertUrlNotPrivate, UA, fetchAndExtract, downloadAllImages } from "@/lib/fetch-utils";
import { MIN_CONTENT_LENGTH } from "@/lib/content-extractor";

/**
 * 代理抓取网页内容，提取正文 HTML（含图片下载到本地）。
 * 支持：
 * - 知乎：Playwright + Cookie 注入 + 隐身脚本绕过反爬
 * - 微信公众号：cheerio 提取正文
 * - 通用站点的统一提取器（fetchAndExtract，自带浏览器兜底，覆盖 CSDN 521 等）
 * - 首页检测
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const cookie = typeof body.cookie === "string" ? body.cookie.trim() : undefined;

    if (!url) {
      return NextResponse.json({ error: "缺少 url 参数" }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "URL 格式无效" }, { status: 400 });
    }
    // SSRF 防护：拦截内网/保留地址（IP 字面量）
    if (isPrivateUrl(url)) {
      return NextResponse.json({ error: "禁止访问内网/保留地址" }, { status: 400 });
    }

    // ====== 首页检测 ======
    if (isHomepageUrl(url)) {
      return NextResponse.json(
        { error: "这是网站首页，没有可供阅读的文章内容" },
        { status: 404 }
      );
    }

    // ====== 根据站点类型选择策略 ======
    if (url.includes("zhuanlan.zhihu.com") || url.includes("zhihu.com")) {
      return await fetchZhihuPage(url, cookie);
    }

    if (url.includes("mp.weixin.qq.com") || url.includes("weixin.qq.com")) {
      return await fetchWechatPage(url);
    }

    return await fetchGenericPage(url, cookie);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("timeout") || msg.includes("abort")) {
      return NextResponse.json({ error: "请求超时，目标网站响应过慢" }, { status: 504 });
    }
    if (msg.includes("禁止")) {
      return NextResponse.json({ error: msg.slice(0, 200) }, { status: 400 });
    }
    return NextResponse.json(
      { error: "抓取失败: " + msg.slice(0, 200) },
      { status: 500 }
    );
  }
}

// ======================== 知乎页面抓取 ========================

/**
 * 知乎抓取：已接入统一提取器 fetchAndExtract。
 *
 * fetchAndExtract 底层仍通过 scrapePageHtml 走 Playwright + Cookie 注入 + 隐身脚本，
 * 保留原有 Akamai 反爬核心；本层只负责把提取结果转译为 fetch-page 的返回格式。
 *
 * 流程：
 * 1. 有 Cookie → fetchAndExtract → 返回正文 HTML
 * 2. 无 Cookie → 返回 zhihuBlocked 标记，引导用户配置 Cookie
 */
async function fetchZhihuPage(
  url: string,
  cookie?: string
): Promise<NextResponse> {
  // 无 Cookie 时，提示用户配置
  if (!cookie) {
    return NextResponse.json(
      {
        error: "知乎抓取需要配置 Cookie，请前往 设置 → 抓取配置 添加 zhihu.com 的 Cookie",
        zhihuBlocked: true,
      },
      { status: 403 }
    );
  }

  let extracted;
  try {
    extracted = await fetchAndExtract(url, cookie);
  } catch (e: any) {
    console.error("[proxy/fetch-page] fetchZhihuPage fetchAndExtract failed:", e?.message || e);
    return NextResponse.json(
      {
        error: e?.message || "知乎抓取失败，请检查 Cookie 是否有效",
        zhihuBlocked: true,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    html: extracted.contentHtml || "",
    title: extracted.title || "",
    images: (extracted.imgUrls || []).map((u) => ({ url: u, localUrl: u })),
  });
}

// ======================== 微信公众号抓取 ========================

async function fetchWechatPage(url: string): Promise<NextResponse> {
  try {
    await assertUrlNotPrivate(url);
  } catch {
    return NextResponse.json({ error: "禁止访问内网/保留地址" }, { status: 400 });
  }
  const resp = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) {
    return NextResponse.json({ error: `目标网站返回 ${resp.status}` }, { status: 502 });
  }
  const html = await resp.text();
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  // 检查是否失效
  if ($(".weui-msg__title").length > 0) {
    return NextResponse.json({ error: "该文章已失效或被删除" }, { status: 404 });
  }

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim() ||
    "";

  // 微信公众号正文在 #js_content 中
  const $content = $("#js_content");
  if (!$content.length) {
    return NextResponse.json({ error: "未能找到微信公众号文章内容" }, { status: 404 });
  }

  // 提取并下载图片
  const imgUrls: string[] = [];
  $content.find("img").each((_i: number, el: any) => {
    const src = $(el).attr("data-src") || $(el).attr("src") || "";
    if (src && src.startsWith("http") && !src.startsWith("data:")) {
      imgUrls.push(src);
    }
  });

  const urlMap = await downloadAllImages(imgUrls, url);

  $content.find("img").each((_i: number, el: any) => {
    const $el = $(el);
    const src = $el.attr("data-src") || $el.attr("src") || "";
    const local = urlMap.get(src);
    if (local) {
      $el.attr("src", local);
      $el.removeAttr("data-src");
    }
  });

  // 移除干扰
  $content.find("script, style, svg, button, canvas, iframe").remove();

  const bodyHtml = $content.html() || "";
  if (!bodyHtml || bodyHtml.length < 30) {
    return NextResponse.json({ error: "未能提取到有效正文内容" }, { status: 404 });
  }

  return NextResponse.json({ html: bodyHtml, title });
}

// ======================== 通用页面抓取（统一提取器 fetchAndExtract） ========================

/**
 * 通用站点抓取：调用 fetchAndExtract（统一提取器）。
 *
 * fetchAndExtract 内部流程：
 * 1. 先 HTTP fetch → extractContent；
 * 2. 若状态码命中 FALLBACK_STATUS_CODES（含 CSDN 521）或内容过短，
 *    自动走浏览器兜底（scrapePageHtml）→ 再 extractContent；
 * 3. 图片容错下载到本地并替换 src（失败保留远程 URL）。
 *
 * 知乎 / 微信分支不走此函数（上方已单独处理）。
 */
async function fetchGenericPage(url: string, cookie?: string): Promise<NextResponse> {
  try {
    await assertUrlNotPrivate(url);
    const extracted = await fetchAndExtract(url, cookie);
    if (!extracted.contentHtml || extracted.contentHtml.length < 50) {
      return NextResponse.json(
        { error: "未能提取到有效正文内容" },
        { status: 404 }
      );
    }

    // 首页内容过短保护：如果 URL 是首页且正文不足，提示用户这是首页
    if (isHomepageUrl(url) && (extracted.text || "").length < MIN_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: "该页面为首页，无正文" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      html: extracted.contentHtml,
      title: extracted.title || "",
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("禁止")) {
      return NextResponse.json({ error: msg.slice(0, 200) }, { status: 400 });
    }
    return NextResponse.json(
      { error: "抓取失败: " + msg.slice(0, 200) },
      { status: 502 }
    );
  }
}
