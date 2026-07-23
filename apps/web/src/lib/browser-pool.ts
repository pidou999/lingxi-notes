/**
 * Playwright 浏览器池
 *
 * 维护常驻浏览器实例，按请求分配 BrowserContext，避免反复启动/关闭 Chromium。
 * 首次 acquireContext 时延迟启动，进程退出时自动清理。
 *
 * 设计：
 * - 进程级单例，最多 2 个常驻浏览器实例
 * - acquireContext() 返回一个干净的 BrowserContext
 * - releaseContext() 关闭 context，不关闭浏览器
 * - shutdown() 在进程退出时关闭所有浏览器
 * - 兼容现有 getBrowser() / releaseBrowser() 调用方
 */
import { chromium } from 'playwright';
import type { Browser, BrowserContext } from 'playwright';

// ====== 配置 ======

const POOL_SIZE = 2;

const LAUNCH_ARGS = [
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

// ====== 池实现 ======

class BrowserPool {
  private browsers: Browser[] = [];
  private launched = false;

  /**
   * 获取一个浏览器上下文。
   * 池中无可用浏览器时自动启动（优先 channel:chrome，回退内置 Chromium）。
   */
  async acquireContext(options?: {
    viewport?: { width: number; height: number };
    userAgent?: string;
  }): Promise<{ browser: Browser; context: BrowserContext }> {
    // 找可用浏览器
    let browser = this.browsers.find((b) => b.isConnected());
    if (!browser) {
      browser = await this.launchOne();
      this.browsers.push(browser);
    }

    const context = await browser.newContext({
      viewport: options?.viewport ?? { width: 1920, height: 1080 },
      userAgent:
        options?.userAgent ??
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      geolocation: { latitude: 39.9042, longitude: 116.4074 },
      permissions: ['geolocation'],
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      forcedColors: 'none',
      acceptDownloads: false,
    });

    return { browser, context };
  }

  /**
   * 释放一个上下文（关闭 context，浏览器实例保留在池中）。
   */
  async releaseContext(context: BrowserContext): Promise<void> {
    await context.close().catch(() => {});
  }

  /**
   * 关闭所有浏览器实例。进程退出前调用。
   */
  async shutdown(): Promise<void> {
    for (const b of this.browsers) {
      try {
        await b.close();
      } catch {
        // 浏览器可能已经崩溃
      }
    }
    this.browsers = [];
    this.launched = false;
  }

  /**
   * 池中当前浏览器实例数。
   */
  get size(): number {
    return this.browsers.length;
  }

  // ====== 私有 ======

  private async launchOne(): Promise<Browser> {
    // 尝试系统 Chrome
    try {
      const browser = await chromium.launch({
        channel: 'chrome',
        headless: true,
        args: LAUNCH_ARGS,
      });
      console.log('[browser-pool] launched channel:chrome');
      this.launched = true;
      return browser;
    } catch (chromeErr: any) {
      console.log(
        '[browser-pool] channel:chrome not available (%s), falling back to Playwright Chromium',
        chromeErr.message,
      );
    }

    // 回退内置 Chromium
    const browser = await chromium.launch({
      headless: true,
      args: LAUNCH_ARGS,
    });
    console.log('[browser-pool] launched Playwright Chromium');
    this.launched = true;
    return browser;
  }
}

// ====== 进程级单例 ======

const globalPool = new BrowserPool();

/** 进程退出时自动关闭浏览器 */
process.on('exit', () => {
  globalPool.shutdown().catch(() => {});
});
process.on('SIGINT', () => {
  globalPool.shutdown().catch(() => {}).finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  globalPool.shutdown().catch(() => {}).finally(() => process.exit(0));
});

export default globalPool;
export { BrowserPool };
