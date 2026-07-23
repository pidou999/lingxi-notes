/**
 * 浏览器实例管理 — 进程级单例复用
 *
 * 提供 getBrowser / releaseBrowser 管理 Chromium 实例生命周期。
 * 优先使用系统 Chrome（channel: chrome），回退到 Playwright 内置 Chromium。
 */
import { chromium } from 'playwright';
import type { Browser } from 'playwright';

// ====== 配置 ======

export const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const TIMEOUT = 30000;
export const NAV_TIMEOUT = 20000;
export const DL_TIMEOUT = 15000;
export const MAX_IMAGES = 30;

export const LAUNCH_ARGS = [
  '--no-sandbox',
  '--headless=new',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-extensions',
  '--disable-infobars',
  '--disable-breakpad',
  '--disable-component-extensions-with-background-pages',
  '--disable-component-update',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--mute-audio',
];

// ====== 进程级浏览器实例缓存 ======

let _browser: Browser | null = null;
let _browserRefCount = 0;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 获取浏览器实例。
 * 优先使用系统安装的 Chrome（channel: chrome），其 TLS 指纹与真实用户一致。
 * 如果系统 Chrome 不可用，回退到 Playwright 内置 Chromium。
 */
export async function getBrowser(): Promise<Browser> {
  if (_browser) {
    _browserRefCount++;
    return _browser;
  }

  // 尝试使用系统 Chrome
  try {
    _browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: LAUNCH_ARGS,
    });
    console.log('[scraper] browser launched with channel: chrome');
    _browserRefCount = 1;
    return _browser;
  } catch (chromeErr: any) {
    console.log(
      '[scraper] channel:chrome not available (%s), falling back to Playwright Chromium',
      chromeErr.message,
    );
  }

  // 回退到内置 Chromium
  _browser = await chromium.launch({
    headless: true,
    args: LAUNCH_ARGS,
  });
  console.log('[scraper] browser launched with Playwright Chromium');
  _browserRefCount = 1;
  return _browser;
}

/**
 * 释放浏览器引用计数。引用归零时关闭浏览器实例。
 */
export async function releaseBrowser(): Promise<void> {
  _browserRefCount--;
  if (_browserRefCount <= 0 && _browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}
