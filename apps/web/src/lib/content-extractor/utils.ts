/**
 * 内容提取器 — 工具函数模块
 *
 * 纯函数工具集，供 extractContent 使用：
 * - scoreContainer / fallbackPickContainer：正文容器打分与兜底
 * - toAbsoluteUrl / processImages：图片绝对化与收集
 * - extractTitle：标题提取
 * - applyDensityOptimization / normalizeCsdnCodeBlocks：密度优化与 CSDN 代码块归一化
 * - pickSiteConfig / resolveSiteKey：站点配置匹配
 */
import type { SiteConfig } from './index';
import { SITE_CONFIGS } from './sites';
import { FALLBACK_CONFIG } from './fallback';

/** 正文 block 级标签（用于打分与密度保护） */
const CONTENT_BLOCK_TAGS = [
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'P', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'TABLE', 'PRE',
];

// ====== 站点配置匹配 ======

/**
 * 根据 hostname 选择站点配置。
 * 先精确匹配；未命中则按「后缀匹配」（如 sub.cloud.tencent.com 命中 cloud.tencent.com）。
 * 均未命中返回通用兜底配置。
 */
export function pickSiteConfig(hostname: string): SiteConfig {
  if (SITE_CONFIGS[hostname]) return SITE_CONFIGS[hostname];
  for (const key of Object.keys(SITE_CONFIGS)) {
    if (hostname === key || hostname.endsWith('.' + key)) {
      return SITE_CONFIGS[key];
    }
  }
  return FALLBACK_CONFIG;
}

/**
 * 返回命中的站点 key（用于 ExtractResult.site）。未命中返回 undefined。
 */
export function resolveSiteKey(hostname: string): string | undefined {
  if (SITE_CONFIGS[hostname]) return hostname;
  for (const key of Object.keys(SITE_CONFIGS)) {
    if (hostname === key || hostname.endsWith('.' + key)) return key;
  }
  return undefined;
}

// ====== 正文容器打分 ======

/**
 * 对候选容器打分：block 标签越多越好，噪声 class 越多越差，图片为次要加分项。
 */
export function scoreContainer($el: any, config: SiteConfig): number {
  const blockCount = $el.find(CONTENT_BLOCK_TAGS.join(',')).length;
  const classAttr = ($el.attr('class') || '').toLowerCase();
  const noiseKw = config.noiseClassKeywords || [];
  const noiseCount = noiseKw.filter((k: string) => classAttr.includes(k)).length;
  const imgCount = Math.min($el.find('img').length, 5);
  return blockCount * 10 - noiseCount * 50 + imgCount;
}

// ====== 图片处理 ======

/**
 * 将图片地址转为绝对地址。
 * 支持：// 协议相对、/ 绝对路径、相对路径、data: 与 http(s) 直链。
 */
function toAbsoluteUrl(src: string, baseUrl: string): string {
  try {
    if (src.startsWith('//')) return 'https:' + src;
    if (src.startsWith('http') || src.startsWith('data:')) return src;
    if (src.startsWith('/')) {
      const origin = new URL(baseUrl).origin;
      return origin + src;
    }
    return new URL(src, baseUrl).href;
  } catch {
    return '';
  }
}

/**
 * 处理容器内的图片：懒加载属性 → src，相对路径转绝对，收集 imgUrls。
 */
export function processImages($: any, $content: any, baseUrl: string): string[] {
  const imgUrls: string[] = [];
  const seen = new Set<string>();

  $content.find('img').each((_: number, el: any) => {
    const $el = $(el);
    let src =
      $el.attr('data-src') ||
      $el.attr('data-actualsrc') ||
      $el.attr('data-original') ||
      $el.attr('data-lazy-src') ||
      $el.attr('data-normal') ||
      $el.attr('src') ||
      '';
    if (!src) return;

    const abs = toAbsoluteUrl(src, baseUrl);
    if (!abs) return;

    $el.attr('src', abs);
    $el.removeAttr('data-src data-actualsrc data-original data-lazy-src data-normal');
    $el.removeAttr('class style srcset sizes');
    $el.attr('loading', 'lazy');

    if (!seen.has(abs)) {
      seen.add(abs);
      imgUrls.push(abs);
    }
  });

  return imgUrls;
}

// ====== 标题提取 ======

/**
 * 提取标题：按 titleSelectors → og:title → document.title 兜底。
 */
export function extractTitle($: any, config: SiteConfig): string {
  const titleSels = config.titleSelectors || ['h1', '.title', '.article-title', '.post-title'];
  for (const sel of titleSels) {
    const t = $(sel).first().text().trim();
    if (t) return t;
  }
  const og = $('meta[property="og:title"]').attr('content');
  if (og) return og.trim();
  return ($('title').text() || '').trim();
}

// ====== 密度优化 ======

/**
 * 文本密度优化：当容器包含过多子 div 且大部分文本密度低，仅保留文本密度最高的子区域。
 * block 标签数达到阈值则跳过（保护结构化正文）。
 */
export function applyDensityOptimization($: any, $content: any, threshold: number): void {
  const blockTagCount = $content.find(CONTENT_BLOCK_TAGS.join(',')).length;
  if (blockTagCount >= threshold) return;

  const children = $content.children('div').toArray();
  if (children.length <= 20) return;

  const shortDivs = children.filter(
    (c: any) => ($(c).text() || '').replace(/\s+/g, '').length < 30
  );
  if (shortDivs.length / children.length <= 0.6) return;

  let bestChild: any = null;
  let bestLen = 0;
  for (const c of children) {
    const len = ($(c).text() || '').replace(/\s+/g, '').length;
    if (len > bestLen) {
      bestLen = len;
      bestChild = c;
    }
  }

  if (bestChild && bestLen > 200) {
    $content.empty();
    $content.append($(bestChild).clone());
  }
}

// ====== CSDN 代码块归一化 ======

/**
 * 归一化 CSDN 代码块：行号列表/复制按钮 → 纯 pre>code。
 */
export function normalizeCsdnCodeBlocks($: any, $content: any): void {
  $content.find('pre').each((_: number, el: any) => {
    const $pre = $(el);

    $pre
      .find(
        '.hljs-button, .hljs-ln-numbers, .code-btn, .copy-btn, .pre-numbering, .copyright, [data-title]'
      )
      .remove();

    $pre.removeAttr('class style');

    const $ln = $pre.find('.hljs-ln');
    if ($ln.length > 0) {
      const lines: string[] = [];
      $ln.find('tr').each((__: number, row: any) => {
        const $codeCol = $(row).find('.hljs-ln-code, .ln-code');
        lines.push(($codeCol.length ? $codeCol.text() : $(row).text()) || '');
      });
      if (lines.length === 0) {
        $ln.find('li').each((__: number, li: any) => {
          lines.push($(li).text() || '');
        });
      }
      if (lines.length > 0) {
        const codeText = lines.join('\n');
        $pre.empty();
        $pre.append($('<code></code>').text(codeText));
        return;
      }
    }

    if ($pre.find('code').length === 0) {
      const codeText = $pre.text() || '';
      if (codeText.trim().length > 0) {
        $pre.empty();
        $pre.append($('<code></code>').text(codeText));
      }
    }
  });
}

// ====== 通用 body 兜底扫描 ======

/**
 * 当所有 contentSelectors 均未命中时，做一次通用 body 扫描：
 * 选「图片数 × 2000 + 文本长度」最高的 div/section/main/article 作为正文容器。
 */
export function fallbackPickContainer($: any, url?: string): any {
  let best: any = null;
  let bestScore = 0;

  const hostname = (() => {
    try {
      return new URL(url || '').hostname;
    } catch {
      return '';
    }
  })();

  // 知乎兜底：正文一定在 .RichText 内
  if (hostname.includes('zhihu.com')) {
    let bestZhihu: any = null;
    let bestZhihuLen = 0;
    $('.RichText, .Post-RichText, .ContentItem-RichText').each((_: number, el: any) => {
      const $el = $(el);
      const txt = ($el.text() || '').replace(/\s+/g, '').length;
      if (txt > bestZhihuLen) {
        bestZhihuLen = txt;
        bestZhihu = $el;
      }
    });
    if (bestZhihu && bestZhihuLen > 100) return bestZhihu;
  }

  $('div, section, main, article').each((_: number, el: any) => {
    const $el = $(el);
    const txt = ($el.text() || '').replace(/\s+/g, '').length;
    const imgs = $el.find('img').length;
    const score = txt + imgs * 2000;
    if (txt > 200 && score > bestScore) {
      bestScore = score;
      best = $el;
    }
  });

  if (best) return best;
  const body = $('body');
  return body.length ? body : null;
}
