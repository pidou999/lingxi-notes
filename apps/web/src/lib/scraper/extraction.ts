/**
 * 浏览器内执行的内容提取函数
 *
 * 这些函数在 Playwright 的 page.evaluate 中执行，直接操作 DOM。
 */
import { extractContent } from '../content-extractor';

/** 从 DOM 中提取的结构化内容（浏览器端） */
export interface ExtractResult {
  html: string;
  text: string;
  title: string;
  images: { src: string; alt: string }[];
}

/**
 * 在浏览器端提取页面内容（page.evaluate 回调）。
 * 返回标题 + 正文 HTML + 图片列表。
 */
export function extractPageContent(): ExtractResult {
  const title = document.title || '';
  const html = document.body.innerHTML || '';

  const images: { src: string; alt: string }[] = [];
  try {
    const imgEls = document.querySelectorAll('img');
    const seen = new Set<string>();
    imgEls.forEach((img) => {
      const src =
        img.getAttribute('data-src') ||
        img.getAttribute('data-actualsrc') ||
        img.getAttribute('data-original') ||
        img.getAttribute('data-lazy-src') ||
        img.getAttribute('src') ||
        '';
      if (src && !seen.has(src)) {
        seen.add(src);
        images.push({ src, alt: img.alt || '' });
      }
    });
  } catch {
    // silent
  }

  let text = '';
  try {
    text = (document.body.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    text = '';
  }

  return { html, text, title, images };
}

/** 在浏览器端对候选正文容器评分 */
export function scoreContentContainer(el: Element): number {
  const blockTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'TABLE', 'PRE'];
  let blockCount = 0;
  blockTags.forEach((tag) => {
    blockCount += el.querySelectorAll(tag).length;
  });

  const classStr = ((el as HTMLElement).className || '').toLowerCase();
  const noiseKeywords = [
    'nav', 'sidebar', 'footer', 'header', 'menu', 'ad', 'comment',
    'recommend', 'related', 'promo', 'coupon', 'copyright',
  ];
  const noiseCount = noiseKeywords.filter((kw) => classStr.includes(kw)).length;
  const imgCount = Math.min(el.querySelectorAll('img').length, 5);

  return blockCount * 10 - noiseCount * 50 + imgCount;
}

/** 在浏览器端处理图片：懒加载属性 → src */
export function processImgs(container: Element, baseUrl: string): void {
  container.querySelectorAll('img').forEach((img) => {
    const src =
      img.getAttribute('data-src') ||
      img.getAttribute('data-actualsrc') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-lazy-src') ||
      img.getAttribute('src') ||
      '';

    if (src) {
      let finalSrc = src;
      if (src.startsWith('//')) finalSrc = 'https:' + src;
      else if (src.startsWith('/')) finalSrc = new URL(src, baseUrl).href;
      else if (!src.startsWith('http')) finalSrc = new URL(src, baseUrl).href;

      img.setAttribute('src', finalSrc);
      img.removeAttribute('data-src');
      img.removeAttribute('data-actualsrc');
      img.removeAttribute('data-original');
      img.removeAttribute('data-lazy-src');
    }
  });
}

/**
 * 服务端正文提取（调用 cheerio 的 extractContent）。
 * 当浏览器端提取结果不理想时，使用渲染后的 HTML 做二次提取。
 */
export async function extractFromHtml(html: string, url: string) {
  return extractContent(html, url);
}
