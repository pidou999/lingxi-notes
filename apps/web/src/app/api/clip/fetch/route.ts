import { NextRequest, NextResponse } from "next/server";
import { fetchAndExtract, downloadAllImages, isPrivateUrl, assertUrlNotPrivate } from "@/lib/fetch-utils";

// ====== 配置 ======

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// ====== 表格转 Markdown 辅助函数 ======
// turndown 原生不支持 <table>，会被拍平成纯文本。
// 用 DOM 级规则（而非字符串正则）来处理，更健壮。

/** 将单元格 HTML 转为纯文本（strip tags，合并空白） */
function cellText(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** 在 turndown 上注册表格处理规则 */
function addTableRules(td: any): void {
  // 规则 1: 标准 <table> 标签
  td.addRule("table", {
    filter: "table",
    replacement: (_content: string, node: any) => {
      const rows = node.querySelectorAll?.("tr");
      if (!rows || rows.length === 0) return "";
      const colCount = Math.max(
        ...Array.from(rows).map(
          (tr: any) => tr.querySelectorAll?.("td, th")?.length ?? 0
        )
      );
      if (colCount === 0) return "";

      const mdRows: string[] = Array.from(rows).map((tr: any) => {
        const cells = Array.from(tr.querySelectorAll?.("td, th") ?? []);
        const cellTexts = cells.map((c: any) => cellText(c.innerHTML || c.textContent || ""));
        while (cellTexts.length < colCount) cellTexts.push("");
        return "| " + cellTexts.join(" | ") + " |";
      });

      const sep = "| " + Array(colCount).fill("---").join(" | ") + " |";
      mdRows.splice(1, 0, sep);
      return "\n\n" + mdRows.join("\n") + "\n\n";
    },
  });

  // 规则 2: div 模拟表格（外层 container → 多个 row div → 每个 row 内有 ≥2 个 cell div）
  td.addRule("divTable", {
    filter: (node: any, _options: any) => {
      if (!node || node.nodeName !== "DIV") return false;
      const children: any[] = Array.from(node.children ?? []);
      if (children.length < 2) return false;
      const allDivChildren = children.every((c: any) => c.nodeName === "DIV");
      if (!allDivChildren) return false;
      // 检查第一个子 div 是否包含 ≥2 个子 div（row → cells 结构）
      const firstChild = children[0];
      const grandChildren: any[] = Array.from(firstChild?.children ?? []);
      return grandChildren.length >= 2 &&
        grandChildren.every((gc: any) => gc.nodeName === "DIV");
    },
    replacement: (_content: string, node: any) => {
      const children = Array.from(node.children);
      const rowData: string[][] = [];
      let maxCols = 0;

      for (const row of children) {
        const cellEls = Array.from((row as any).children ?? []);
        const cells = cellEls.map((c: any) => cellText(c.innerHTML || c.textContent || ""));
        if (cells.length >= 2) {
          maxCols = Math.max(maxCols, cells.length);
          rowData.push(cells);
        }
      }

      if (rowData.length < 2) return "";

      for (const row of rowData) {
        while (row.length < maxCols) row.push("");
      }

      const mdRows = rowData.map((r) => "| " + r.join(" | ") + " |");
      const sep = "| " + Array(maxCols).fill("---").join(" | ") + " |";
      mdRows.splice(1, 0, sep);
      return "\n\n" + mdRows.join("\n") + "\n\n";
    },
  });
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
    signal: AbortSignal.timeout(20000),
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

  // 表格规则（turndown 原生不支持 table/div 表格）
  addTableRules(td);

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

// ====== 知乎文章抓取（已接入统一提取器 fetchAndExtract） ======

async function fetchZhihu(
  url: string,
  cookie?: string
): Promise<{
  title: string;
  contentMd: string;
  contentHtml?: string;
  text?: string;
  imgUrls?: string[];
  error?: string;
} | null> {
  let extracted;
  try {
    extracted = await fetchAndExtract(url, cookie);
  } catch (e: any) {
    console.error("[clip/fetch] fetchZhihu fetchAndExtract failed:", e?.message || e);
    return { title: '', contentMd: '', error: e?.message || '抓取失败' };
  }

  const Turndown = (await import("turndown")).default;
  const td = new Turndown({
    headingStyle: "atx",
    linkStyle: "inlined",
    codeBlockStyle: "fenced",
  });
  addTableRules(td);

  let contentMd = td.turndown(extracted.contentHtml || "");
  if (!contentMd || contentMd.length < 20) {
    contentMd = (extracted.text || "").trim();
  }
  if (!contentMd || contentMd.length < 20) return null;

  // ========== 知乎后处理：清理广告/噪音文案（兜底，extractContent 已做主要清理） ==========
  contentMd = contentMd
    // 移除 "本文由 xxx 多平台发布" 分发水印
    .replace(/^本文由 .* 多平台发布.*$/gm, "")
    // 移除 "发布于 2026-01-28 08:57 · 北京" 发布元信息
    .replace(/^发布于 \d{4}[-\/]\d{1,2}[-\/]\d{1,2}\s*\d{0,2}[:\d]*\s*·.*$/gm, "")
    // 移除 "编辑于 ..." 编辑元信息
    .replace(/^编辑于 .*$/gm, "")
    // 移除 "著作权归作者所有" 著作权声明
    .replace(/^著作权归作者所有.*$/gm, "")
    // 移除 "xxx 的广告" 广告标记
    .replace(/^.* 的广告$/gm, "")
    // 移除豆包等 AI 产品广告文案
    .replace(/^豆包.*$/gm, "")
    // 移除以「字节自研大模型 / 豆包 / 特惠来袭 / 火山引擎 / 100+热议 / 云一哥」开头的整段广告块
    .replace(/^(?:字节自研大模型|豆包|特惠来袭|火山引擎|100\+热议|云一哥)[\s\S]*?(?=\n\n|(?![\s\S]))/gm, "")
    // 移除赞赏/邀请赞赏文案
    .replace(/^.*赞赏.*支持.*$/gm, "")
    .replace(/^.*打赏.*$/gm, "")
    // 移除知乎 UI 操作按钮文案残留
    // 同时支持："赞同"、"1.2万赞同"、"赞同 1.2 万"、"1203 赞同"、"赞同 1203" 等
    .replace(/^\s*(?:\d+(?:\.\d+)?\s*[万亿kK]?\s*)?(?:赞同|喜欢|收藏|分享|添加评论)\s*$/gim, "")
    .replace(/^\s*(?:赞同|喜欢|收藏|分享|添加评论)\s*(?:\d+(?:\.\d+)?\s*[万亿kK]?)?\s*$/gim, "")
    // 兜底：移除 scraper DOM 层可能漏掉的知乎"推荐阅读"卡片整行链接
    .replace(/^\s*\[[^\]]+\]\(https?:\/\/zhuanlan\.zhihu\.com\/p\/\S+\)\s*$/gm, "")
    // 清理多余空行
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    title: extracted.title || "",
    contentMd,
    contentHtml: extracted.contentHtml || "",
    text: extracted.text || "",
    imgUrls: extracted.imgUrls || [],
  };
}

// ====== 通用站点抓取（统一提取器 fetchAndExtract） ======

async function fetchGeneric(url: string, cookie?: string): Promise<{
  title: string;
  contentMd: string;
  contentHtml: string;
  text: string;
  imgUrls: string[];
} | null> {
  let extracted;
  try {
    extracted = await fetchAndExtract(url, cookie);
  } catch (e: any) {
    console.error("[clip/fetch] fetchGeneric fetchAndExtract failed:", e?.message || e);
    return null;
  }

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
      if (!href || href.startsWith("javascript:") || href === "#") return content;
      return `[${content}](${href})`;
    },
  });

  addTableRules(td);

  let contentMd = td.turndown(extracted.contentHtml || "");
  if (!contentMd || contentMd.length < 20) {
    contentMd = (extracted.text || "").trim();
  }
  if (!contentMd || contentMd.length < 20) return null;

  // ========== 通用后处理：清理噪音文案 ==========
  contentMd = contentMd
    // 移除 "分享到xxx" / "收藏xxx" / "点赞xxx" 等操作文案
    .replace(/^分享到.*$/gm, "")
    .replace(/^收藏.*$/gm, "")
    .replace(/^点赞.*$/gm, "")
    // 移除非 markdown link 格式的 "原文链接xxx"（单独一行纯文本链接）
    .replace(/^原文链接[：:]\s*(?!http|\[).*$/gm, "")
    // 移除 "扫码关注xxx" / "长按识别xxx" 二维码引导文字
    .replace(/^扫码关注.*$/gm, "")
    .replace(/^长按识别.*$/gm, "")
    // Bug 4: 移除分发水印（如 "Web 挖掘机"、"次转发" 等）
    .replace(/^.*Web 挖掘机.*$/gm, "")
    .replace(/^.*次转发.*$/gm, "")
    .replace(/^.*多平台发布.*$/gm, "")
    .replace(/^.*自动抓取.*$/gm, "")
    // 清理多余空行
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    title: extracted.title || "",
    contentMd,
    contentHtml: extracted.contentHtml || "",
    text: extracted.text || "",
    imgUrls: extracted.imgUrls || [],
  };
}

// ====== 头条文章抓取（使用 Baidu Spider UA 触发 SSR） ======

const BAIDU_UA =
  "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)";

async function fetchToutiao(url: string): Promise<{
  title: string;
  contentMd: string;
} | null> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": BAIDU_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) return null;
  const html = await resp.text();
  if (html.length < 1000) return null;

  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  // 1. 标题：优先 JSON-LD，其次 h1
  let title = "";
  const jsonLd = $('script[type="application/ld+json"]').first().text();
  if (jsonLd) {
    try {
      const parsed = JSON.parse(jsonLd);
      title = parsed.headline || "";
    } catch {}
  }
  if (!title) title = $("h1").first().text().trim();
  if (!title) title = $('meta[property="og:title"]').attr("content") || "";

  // 2. 提取正文区
  let contentEl = $("article.syl-article-base").first();
  if (!contentEl.length) contentEl = $("article").first();
  if (!contentEl.length) contentEl = $('[class*="article-content"]').first();
  if (!contentEl.length) return null;

  // 3. 提取图片
  const imgUrls: string[] = [];
  contentEl.find("img").each((_: number, el: any) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    if (src && src.startsWith("http") && !src.startsWith("data:")) {
      imgUrls.push(src);
    }
  });

  const urlMap = await downloadAllImages(imgUrls, url);

  // 替换图片地址
  contentEl.find("img").each((_: number, el: any) => {
    const $el = $(el);
    const original = $el.attr("src") || $el.attr("data-src") || "";
    const local = urlMap.get(original);
    if (local) {
      $el.attr("src", local);
      const attrs = ($el[0] as any).attribs || {};
      for (const key of Object.keys(attrs)) {
        if (key.startsWith("data-")) $el.removeAttr(key);
      }
    }
  });

  contentEl.find("script, style, svg, iframe, .ttp-comment-block").remove();

  // 4. HTML → Markdown
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
      if (!href || href.startsWith("javascript:") || href === "#") return content;
      return `[${content}](${href})`;
    },
  });

  // 表格规则（turndown 原生不支持 table/div 表格）
  addTableRules(td);

  const contentHtml = contentEl.html() || "";
  let contentMd = td.turndown(contentHtml);
  contentMd = contentMd.replace(/\n{4,}/g, "\n\n\n").trim();

  if (!contentMd || contentMd.length < 20) return null;

  // 5. 从 JSON-LD 提取元信息
  let source = "";
  let publishTime = "";
  try {
    if (jsonLd) {
      const parsed = JSON.parse(jsonLd);
      if (parsed.author?.name) source = parsed.author.name;
      if (parsed.datePublished) publishTime = parsed.datePublished.replace("T", " ").replace(/\+\d{2}:\d{2}$/, "");
    }
  } catch {}

  const metaParts: string[] = [];
  if (source) metaParts.push(`**来源**：${source}`);
  if (publishTime) metaParts.push(`**时间**：${publishTime}`);
  metaParts.push(`**原文**：[${url}](${url})`);

  contentMd = `${metaParts.join("\n")}\n\n---\n\n${contentMd}`;

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
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ success: false, error: "URL 格式无效" }, { status: 400 });
    }
    // SSRF 防护（IP 字面量）：用户提交的文章链接不应指向内网/保留地址
    if (isPrivateUrl(url)) {
      return NextResponse.json({ success: false, error: "禁止访问内网/保留地址" }, { status: 400 });
    }
    // SSRF 防护（DNS 二次校验）：拦截「域名 → 内网 IP」的 DNS 重绑定绕过
    try {
      await assertUrlNotPrivate(url);
    } catch {
      return NextResponse.json({ success: false, error: "禁止访问内网/保留地址" }, { status: 400 });
    }

    let result: {
      title: string;
      contentMd: string;
      error?: string;
      contentHtml?: string;
      text?: string;
      imgUrls?: string[];
    } | null = null;

    // ===== 微信 =====
    if (url.includes("mp.weixin.qq.com") || url.includes("weixin.qq.com")) {
      result = await fetchWechat(url);
      if (!result) {
        return NextResponse.json(
          {
            success: false,
            error: "无法抓取该微信文章，可能已失效或需要登录",
          },
          { status: 400 }
        );
      }
    }
    // ===== 知乎 =====
    else if (
      url.includes("zhuanlan.zhihu.com") ||
      url.includes("zhihu.com")
    ) {
      result = await fetchZhihu(url, cookie);
      if (!result) {
        return NextResponse.json(
          {
            success: false,
            error: "知乎因反爬策略无法自动抓取，请在浏览器中打开链接后手动保存内容",
          },
          { status: 400 }
        );
      }
      // 传递来自 scrapeUrl 的具体错误信息（如 Cookie 缺失/失效）
      if ('error' in result && result.error) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
    }
    // ===== 头条 =====
    else if (
      url.includes("toutiao.com") ||
      url.includes("toutiaohao.com")
    ) {
      result = await fetchToutiao(url);
      if (!result) {
        return NextResponse.json(
          {
            success: false,
            error: "无法抓取该头条文章，可能已失效或需要登录",
          },
          { status: 400 }
        );
      }
    } else {
      // ===== 通用站点（统一提取器 fetchAndExtract，自带浏览器兜底） =====
      result = await fetchGeneric(url, cookie);
    }

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: "无法从该页面提取内容，暂不支持该网站",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      title: result.title,
      content: result.contentMd,
      contentHtml: result.contentHtml || "",
      text: result.text || "",
      imgUrls: result.imgUrls || [],
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
