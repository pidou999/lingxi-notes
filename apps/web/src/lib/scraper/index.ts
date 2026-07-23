/**
 * Playwright 网页抓取模块 — 入口
 *
 * 整合子模块：browser / stealth / navigation / extraction / image。
 * 对外暴露 scrapeUrl、scrapePageHtml、parseCookieString、ScrapeResult。
 *
 * 食用方式（拆分后外部 import 路径不变）：
 * ```ts
 * import { scrapeUrl, scrapePageHtml, parseCookieString } from '@/lib/scraper';
 * ```
 */
import path from 'path';
import fs from 'fs/promises';
import type { BrowserContext, Page } from 'playwright';
import pool from '../browser-pool';
import { sleep, DESKTOP_UA, NAV_TIMEOUT } from './browser';
import { stealthInitScript } from './stealth';
import { waitForRealContent } from './navigation';
import { extractPageContent } from './extraction';
import { downloadImages } from './image';
import { extractContent } from '../content-extractor';

// ====== Cookie 解析 ======

/**
 * 解析 Cookie 字符串，支持三种格式：
 *
 * 1. Chrome DevTools 表格格式（Tab 分隔，多行）
 * 2. HTTP Header 格式（分号分隔）
 * 3. 逐行格式（换行分隔）
 */
export function parseCookieString(rawStr: string): { name: string; value: string; domain?: string }[] {
  if (!rawStr) return [];
  const cookies: { name: string; value: string; domain?: string }[] = [];
  const seen = new Set<string>();

  // 第一步：检测 Tab 分隔的 Chrome 格式
  if (rawStr.includes('\t')) {
    const lines = rawStr.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes('\t')) continue;
      const cols = trimmed.split('\t');
      const name = (cols[0] || '').trim();
      const value = (cols[1] || '').trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        cookies.push({ name, value, domain: cols[2]?.trim() });
      }
    }
    return cookies;
  }

  // 第二步：按分号或换行分割
  const segments = rawStr.split(/[;\n\r]+/);
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed || !trimmed.includes('=')) continue;
    const eqIdx = trimmed.indexOf('=');
    const name = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      cookies.push({ name, value });
    }
  }

  return cookies;
}

// ====== 类型定义 ======

export interface ScrapeResult {
  success: boolean;
  title?: string;
  content?: string;
  contentHtml?: string;
  /** 渲染后完整 HTML 字符串（供统一提取器兜底） */
  pageHtml?: string;
  images?: { url: string; localUrl: string }[];
  error?: string;
}

// ====== 核心抓取函数 ======

export async function scrapeUrl(url: string, cookie?: string): Promise<ScrapeResult> {
  let context: BrowserContext | null = null;

  try {
    const { context: ctx } = await pool.acquireContext();
    context = ctx;

    // Inject stealth init script
    await context.addInitScript(stealthInitScript());

    // Inject cookies
    const hasCookie = !!cookie;
    if (cookie) {
      const parsedCookies = parseCookieString(cookie);
      console.log('[scraper] cookie parsed: count=%d names=%j', parsedCookies.length, parsedCookies.map(c => c.name));
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      await context.addCookies(
        parsedCookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: domain.includes('zhihu.com') ? '.zhihu.com' : domain,
          path: '/',
        }))
      );
    }

    const page = await context.newPage();

    // 双通道反爬重定向检测
    let antiBotRedirect = false;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        const fUrl = frame.url();
        if (fUrl.includes('unhuman') || fUrl.includes('captcha') || fUrl.includes('signin') || fUrl === 'https://www.zhihu.com/') {
          antiBotRedirect = true;
        }
      }
    });
    context.on('page', (newPage) => {
      const u = newPage.url();
      if (u.includes('unhuman') || u.includes('captcha') || u.includes('signin')) {
        antiBotRedirect = true;
      }
    });

    // ========== 知乎特殊处理：前置导航建立 Session ==========
    const isZhihuUrl = url.includes('zhihu.com');
    if (isZhihuUrl) {
      try {
        console.log('[scraper] zhihu pre-nav to www.zhihu.com');
        await page.goto('https://www.zhihu.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        }).catch(() => {});
        await sleep(1500);

        let preUrl = '';
        try { preUrl = page.url(); } catch {}
        console.log('[scraper] zhihu pre-nav result: url=%s antiBot=%s', preUrl, antiBotRedirect);

        if (antiBotRedirect || preUrl.includes('unhuman') || preUrl.includes('captcha')) {
          console.log('[scraper] zhihu pre-nav blocked, URL=%s', preUrl);
          antiBotRedirect = false;
        }
      } catch (preNavErr: any) {
        console.log('[scraper] zhihu pre-nav error: %s', preNavErr.message || preNavErr);
      }
    }

    // ========== 主目标导航 ==========
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT * 2 });
    } catch (navError: any) {
      if (!navError.message?.includes('timeout') && !navError.message?.includes('closed')) {
        throw navError;
      }
    }

    if (isZhihuUrl) {
      try { console.log('[scraper] zhihu main-nav result: url=%s', page.url()); } catch {}
    }

    // ========== 智能轮询 ==========
    if (isZhihuUrl) {
      let pollAttempts = 0;
      const MAX_POLL = 8;
      while (pollAttempts < MAX_POLL) {
        await sleep(1500);
        pollAttempts++;
        let curUrl = '';
        try { curUrl = page.url(); } catch { break; }

        console.log('[scraper] zhihu poll #%d: url=%s antiBotRedirect=%s', pollAttempts, curUrl, antiBotRedirect);

        const targetHost = new URL(url).hostname;
        const isTargetUrl = curUrl.includes(targetHost);
        const isAntiBot = curUrl.includes('unhuman') || curUrl.includes('captcha') ||
                          curUrl.includes('signin') || curUrl === 'https://www.zhihu.com/' ||
                          curUrl === 'about:blank';

        if (isTargetUrl && !isAntiBot && !antiBotRedirect) {
          console.log('[scraper] zhihu poll #%d: stable at %s', pollAttempts, curUrl);
          break;
        }

        if (isAntiBot || antiBotRedirect) {
          console.log('[scraper] zhihu poll #%d: anti-bot detected url=%s', pollAttempts, curUrl);
          if (pollAttempts >= 3) {
            console.log('[scraper] zhihu poll: giving up after %d attempts', pollAttempts);
            break;
          }
        }
      }
    } else {
      await sleep(2000);
    }

    // 检查页面是否可用
    let currentUrl = '';
    try { currentUrl = page.url(); } catch { return { success: false, error: '页面导航失败，无法加载目标网页' }; }

    if (currentUrl === 'https://www.zhihu.com/' || currentUrl === 'about:blank') {
      return { success: false, error: hasCookie ? 'zhihu.com 的 Cookie 已失效或未通过验证，请更新 Cookie 后重试' : 'Cookie 已失效或未登录，请更新 zhihu.com 的 Cookie' };
    }
    if (antiBotRedirect) {
      console.log('[scraper] antiBotRedirect triggered: url=%s hasCookie=%s currentUrl=%s', url, hasCookie, currentUrl);
      return { success: false, error: hasCookie ? 'zhihu.com 的 Cookie 已失效或未通过验证，请更新 Cookie 后重试' : '需要配置 zhihu.com 的 Cookie，请前往「设置 → 抓取配置」添加后重试' };
    }

    // Wait for content to render
    await waitForRealContent(page, url);

    if (isZhihuUrl) {
      await sleep(5000);
    }

    // 检查 sleep 后是否触发反爬
    try { currentUrl = page.url(); } catch { return { success: false, error: '页面导航失败，无法加载目标网页' }; }
    if (antiBotRedirect || currentUrl.includes('unhuman') || currentUrl.includes('captcha') || currentUrl.includes('signin') || currentUrl === 'https://www.zhihu.com/') {
      return { success: false, error: hasCookie ? 'zhihu.com 的 Cookie 已失效或未通过验证，请更新 Cookie 后重试' : '需要配置 zhihu.com 的 Cookie，请前往「设置 → 抓取配置」添加后重试' };
    }

    // 快速检查页面内容
    if (isZhihuUrl) {
      try {
        const quickCheck = await page.evaluate(() =>
          (document.body?.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 300)
        );
        if (quickCheck.includes('欢迎来到知乎') || quickCheck.includes('请登录') ||
            quickCheck.includes('安全验证') || quickCheck.includes('请您登录后查看更多')) {
          return { success: false, error: hasCookie ? 'zhihu.com 的 Cookie 已失效或未通过验证，请更新 Cookie 后重试' : '需要配置 zhihu.com 的 Cookie，请前往「设置 → 抓取配置」添加后重试' };
        }
      } catch {}
    }

    if (isZhihuUrl) {
      try { console.log('[scraper] zhihu before-extract: url=%s antiBot=%s', page.url(), antiBotRedirect); } catch {}
    }

    // 捕获渲染后的完整 HTML
    let pageHtml = '';
    try { pageHtml = await page.content(); } catch (pe: any) { console.log('[scraper] page.content() failed: %s', pe?.message || pe); }

    let extracted: { html: string; text: string; imgUrls: string[] } = { html: '', text: '', imgUrls: [] };

    // 优先用统一提取器 extractContent
    if (pageHtml && pageHtml.length > 500) {
      try {
        const unified = await extractContent(pageHtml, url);
        if (unified.contentHtml || unified.text.length > 100) {
          extracted = { html: unified.contentHtml, text: unified.text, imgUrls: unified.imgUrls };
          if (isZhihuUrl) {
            console.log('[scraper] zhihu unified extract: htmlLen=%d textLen=%d imgCount=%d',
              extracted.html.length, extracted.text.length, extracted.imgUrls.length);
          }
        }
      } catch (e: any) {
        console.log('[scraper] unified extractContent failed: %s', e?.message || e);
      }
    }

    // 统一提取器没拿到时回退浏览器内 DOM 提取
    if ((!extracted.html && !extracted.text) || extracted.text.length < 100) {
      try {
        const domResult = await page.evaluate(extractPageContent);
        extracted = {
          html: domResult.html,
          text: domResult.text,
          imgUrls: domResult.images.map(i => i.src),
        };
      } catch (evalErr: any) {
        if (evalErr.message?.includes('closed') || evalErr.message?.includes('destroyed')) {
          const cookieErrMsg = hasCookie
            ? 'zhihu.com 的 Cookie 已失效或未通过验证，请更新 Cookie 后重试'
            : '需要配置 zhihu.com 的 Cookie，请前往「设置 → 抓取配置」添加后重试';
          if (antiBotRedirect) return { success: false, error: cookieErrMsg };

          try {
            const curUrl = page.url();
            if (curUrl.includes('unhuman') || curUrl.includes('captcha') || curUrl.includes('signin') || curUrl === 'https://www.zhihu.com/') {
              return { success: false, error: cookieErrMsg };
            }
          } catch {}

          try {
            const pages = context.pages();
            for (const p of pages) {
              try {
                const pUrl = p.url();
                if (pUrl.includes('unhuman') || pUrl.includes('captcha') || pUrl.includes('signin')) return { success: false, error: cookieErrMsg };
                if (p !== page) continue;
                const pTitle = await p.title().catch(() => '');
                if (pTitle.includes('安全验证') || pTitle.includes('验证') || pTitle.includes('欢迎来到知乎')) return { success: false, error: cookieErrMsg };
              } catch {}
            }
          } catch {}

          if (url.includes('zhihu.com')) return { success: false, error: cookieErrMsg };
          return { success: false, error: '页面内容提取失败，请检查 Cookie 是否有效' };
        } else {
          throw evalErr;
        }
      }
    }

    if (!extracted.html && !extracted.text) {
      if (isZhihuUrl) { try { console.log('[scraper] zhihu extract-empty: finalUrl=%s', page.url()); } catch {} }
      return { success: false, error: '无法提取页面内容' };
    }

    if (isZhihuUrl) {
      console.log('[scraper] zhihu extract-result: htmlLen=%d textLen=%d imgCount=%d',
        extracted.html.length, extracted.text.length, extracted.imgUrls.length);
    }

    const title = await page.title();
    console.log('[scraper] url=%s title=%s contentLen=%d', url, title, (extracted.text || '').length);

    if (url.includes('zhihu.com') && extracted.html) {
      try { await fs.writeFile(path.join(process.cwd(), 'debug-zhihu-html.txt'), extracted.html); } catch {}
    }
    if (url.includes('cloud.tencent.com')) {
      console.log('[scraper] tencent-cloud: htmlLen=%d textLen=%d', extracted.html.length, extracted.text.length);
      try {
        const selInfo = await page.evaluate(() => {
          const mdBody = document.querySelector('.J-markdownBody');
          const artContent = document.querySelector('.article-content');
          const docArt = document.querySelector('#docArticleContent');
          const BLOCK_TAGS = 'h1,h2,h3,h4,h5,h6,p,pre,ul,ol,li,blockquote,table';
          return {
            jMarkdownBody: mdBody ? { innerLen: mdBody.innerHTML.length, blockTags: mdBody.querySelectorAll(BLOCK_TAGS).length } : null,
            articleContent: artContent ? { innerLen: artContent.innerHTML.length, blockTags: artContent.querySelectorAll(BLOCK_TAGS).length } : null,
            docArticleContent: docArt ? { innerLen: docArt.innerHTML.length, blockTags: docArt.querySelectorAll(BLOCK_TAGS).length } : null,
          };
        });
        console.log('[scraper] tencent-cloud selectors: %j', selInfo);
      } catch (e: any) { console.log('[scraper] tencent-cloud selector check failed: %s', e.message || e); }
    }

    // 检查已知失败模式
    const titleLC = (title || '').toLowerCase();
    const textLen = (extracted.text || '').length;
    const cookieErrAfterLoad = hasCookie
      ? 'zhihu.com 的 Cookie 已失效或未通过验证，请更新 Cookie 后重试'
      : '需要配置 zhihu.com 的 Cookie，请前往「设置 → 抓取配置」添加';

    if (titleLC.includes('荒原') || titleLC.includes('没有知识')) {
      return { success: false, error: 'Cookie 已失效或未登录，请更新 zhihu.com 的 Cookie' };
    }
    if (titleLC.includes('欢迎来到知乎') || (extracted.text || '').includes('欢迎来到知乎')) {
      return { success: false, error: cookieErrAfterLoad };
    }
    if ((extracted.text || '').includes('发现问题背后的世界') && (extracted.text || '').length < 300) {
      return { success: false, error: cookieErrAfterLoad };
    }
    if (!title && textLen < 200 && isZhihuUrl) {
      return { success: false, error: '页面未能正确加载，请检查 Cookie 是否有效' };
    }
    if (textLen < 100 && titleLC.includes('zhihu')) {
      return { success: false, error: '抓取到的内容不完整，Cookie 可能已过期' };
    }

    // Download images
    let images: { url: string; localUrl: string }[] = [];
    if (extracted.imgUrls && extracted.imgUrls.length > 0) {
      const urlMap = await downloadImages(extracted.imgUrls, url);
      images = Array.from(urlMap.entries()).map(([u, local]) => ({ url: u, localUrl: local }));

      if (extracted.html) {
        for (const [remoteUrl, localUrl] of urlMap) {
          extracted.html = extracted.html.replace(
            new RegExp(remoteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            localUrl,
          );
        }
      }
    }

    return {
      success: true,
      title: title || '',
      content: extracted.text || '',
      contentHtml: extracted.html || '',
      pageHtml,
      images,
    };
  } catch (error: any) {
    return { success: false, error: error.message || '抓取失败' };
  } finally {
    if (context) await pool.releaseContext(context);
  }
}

/**
 * 轻量封装：仅抓取渲染后的完整 HTML 字符串。
 * 供 fetchAndExtract 的浏览器兜底使用。
 */
export async function scrapePageHtml(
  url: string,
  cookie?: string
): Promise<{ success: boolean; pageHtml?: string; error?: string }> {
  try {
    const result = await scrapeUrl(url, cookie);
    if (!result.success && result.pageHtml && result.pageHtml.length > 500) {
      return { success: true, pageHtml: result.pageHtml };
    }
    return {
      success: result.success,
      pageHtml: result.pageHtml,
      error: result.error,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || '浏览器抓取失败' };
  }
}
