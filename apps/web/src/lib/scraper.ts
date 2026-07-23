/**
 * Playwright 网页抓取模块
 *
 * 这是同目录模块化拆分的转发入口。
 * 核心实现在 scraper/index.ts。
 *
 * 拆分后外部 import 路径不变：
 * ```ts
 * import { scrapeUrl, scrapePageHtml, parseCookieString, ScrapeResult } from '@/lib/scraper';
 * ```
 */
export * from './scraper/index';
