import { chromium, type Browser, type Page } from "playwright";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export interface ScrapeResult {
  title: string;
  contentHtml: string;
  images: string[];
  source?: string;
  publishTime?: string;
}

/**
 * 使用 Playwright + 系统 Chrome 渲染 JS 页面并提取 RENDER_DATA
 * 适用于头条等强 JS 依赖的站点
 */
export async function scrapeToutiao(
  url: string,
  timeout = 45000
): Promise<ScrapeResult | null> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  try {
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1280, height: 800 },
      bypassCSP: true,
    });
    page = await context.newPage();

    // 导航到文章页，等待加载完毕
    await page.goto(url, {
      waitUntil: "load",
      timeout,
    });

    // 等待 RENDER_DATA 出现（头条在 JS 渲染后注入）
    try {
      await page.waitForSelector("#RENDER_DATA", { timeout: 25000 });
    } catch {
      // 可能站点类型不同，没有 RENDER_DATA，尝试备用方案
    }

    // 检查页面是否被重定向到错误页
    const currentUrl = page.url();
    if (
      currentUrl.includes("404") ||
      currentUrl.includes("error") ||
      currentUrl.includes("login")
    ) {
      console.error("[browser-scrape] 页面不可访问:", currentUrl);
      return null;
    }

    // 提取 RENDER_DATA
    const data = await page.evaluate(() => {
      const el = document.getElementById("RENDER_DATA");
      if (!el?.textContent) return null;
      try {
        return JSON.parse(decodeURIComponent(el.textContent));
      } catch {
        return null;
      }
    });

    if (!data?.data) return null;

    const articleData = data.data as Record<string, any>;
    const title: string = articleData.title || "";
    const contentHtml: string = articleData.content || "";
    const imageList: Array<{ url: string }> = articleData.imageList || [];
    const images = imageList
      .map((img: any) => img.url || "")
      .filter(Boolean);

    if (!title && !contentHtml) return null;

    return {
      title,
      contentHtml,
      images,
      source: articleData.source || undefined,
      publishTime: articleData.publishTime || undefined,
    };
  } catch (err) {
    console.error("[browser-scrape] 抓取出错:", err);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
