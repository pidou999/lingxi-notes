/**
 * 导航与内容等待模块
 *
 * 负责：
 * - waitForRealContent：等待页面内容就绪（含知乎专栏的渐进式滚动懒加载）
 * - 展开全文按钮智能点击
 */
import type { Page } from 'playwright';
import { sleep } from './browser';

/**
 * 等待页面内容就绪。
 *
 * - 通用：等待 domcontentloaded + networkidle
 * - 知乎：额外做渐进式滚动（400px 步长，150ms 间隔），展开全文按钮点击，多次滚动到底部再回顶
 */
export async function waitForRealContent(page: Page, url: string): Promise<void> {
  const isZhihu = url.includes('zhihu.com');

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
  } catch {
    // timeout 可接受
  }

  if (isZhihu) {
    try {
      // 等待主内容容器出现
      try {
        await page.waitForSelector(
          '.RichText, .Post-RichText, .ContentItem-RichText, .Post-content, .zhuanlan-Post-body',
          { timeout: 8000 },
        );
      } catch {
        // 继续
      }

      // 展开全文按钮智能点击
      try {
        await page.evaluate(async () => {
          const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
          const expandTexts = /展开|阅读全文|继续阅读|显示全部/;
          const candidates = Array.from(document.querySelectorAll('button, a, div, span'));
          for (const el of candidates) {
            const text = (el.textContent || '').trim();
            if (expandTexts.test(text) && text.length <= 20) {
              (el as HTMLElement).click();
              await delay(300);
            }
          }
        });
        await sleep(1500);
      } catch {
        // 点击失败不中断
      }

      // 渐进式滚动到底部触发懒加载，多次回滚确保图片/段落全部加载
      await page.evaluate(async () => {
        const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const step = 400;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await delay(150);
        }
        window.scrollTo(0, 0);
        for (let pass = 0; pass < 3; pass++) {
          window.scrollTo(0, document.body.scrollHeight);
          await delay(1500);
        }
        window.scrollTo(0, 0);
      });
    } catch {
      // silent
    }
  }

  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  } catch {
    // acceptable
  }
}
