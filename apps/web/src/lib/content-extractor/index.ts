/**
 * 统一内容提取器（content-extractor） — 入口模块
 *
 * 按站点配置从 HTML 中提取结构化内容（纯函数，基于 cheerio，与浏览器完全解耦）。
 *
 * 引用方式（因原有文件路径不变，拆分后外部 import 路径不变）：
 * ```ts
 * import { extractContent, ExtractResult, SITE_CONFIGS, FALLBACK_STATUS_CODES, MIN_CONTENT_LENGTH } from '@/lib/content-extractor';
 * ```
 */
import { BASE_NOISE_SELECTORS, FALLBACK_STATUS_CODES, MIN_CONTENT_LENGTH } from './fallback';
export { FALLBACK_STATUS_CODES, MIN_CONTENT_LENGTH };

import { SITE_CONFIGS } from './sites';
export { SITE_CONFIGS };

import {
  pickSiteConfig,
  resolveSiteKey,
  scoreContainer,
  processImages,
  extractTitle,
  applyDensityOptimization,
  normalizeCsdnCodeBlocks,
  fallbackPickContainer,
} from './utils';

import {
  removeZhihuEmbeddedNoise,
  postProcessZhihuText,
  postProcessZhihuHtml,
} from './zhihu';

// ====== 类型定义 ======

/**
 * 结构化提取结果。
 */
export interface ExtractResult {
  /** 文章标题 */
  title: string;
  /** 清理后的正文 HTML（图片已绝对化，src 为远程绝对地址） */
  contentHtml: string;
  /** 纯文本（用于长度阈值判断 / 摘要） */
  text: string;
  /** 作者（可选，部分站点可提取） */
  byline?: string;
  /** 命中的站点 key（如 'cloud.tencent.com'），通用兜底为 undefined */
  site?: string;
  /** 绝对化后的图片地址列表 */
  imgUrls: string[];
}

/**
 * 单站点提取配置。
 */
export interface SiteConfig {
  /** 正文候选容器选择器（优先级从高到低） */
  contentSelectors: string[];
  /** 该站点专属噪音选择器（与全局基础噪音合并后统一清理） */
  cleanupSels: string[];
  /** 达到该 block 标签数则跳过密度优化（保护结构化正文） */
  blockTagThreshold?: number;
  /** 用于打分的 class 噪声关键词 */
  noiseClassKeywords?: string[];
  /** 是否启用文本密度优化 */
  enableDensityOptimization?: boolean;
  /** 标题兜底选择器 */
  titleSelectors?: string[];
}

// ====== 主提取函数 ======

/**
 * 从 HTML 字符串中提取结构化内容。
 *
 * @param html 渲染后的完整 HTML 字符串
 * @param url  页面 URL（用于 hostname 匹配与图片绝对化）
 * @returns ExtractResult
 */
export async function extractContent(html: string, url: string): Promise<ExtractResult> {
  const cheerio = await import('cheerio');
  const $ = cheerio.load(html);

  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = '';
  }

  const config = pickSiteConfig(hostname);
  const site = resolveSiteKey(hostname);

  // 腾讯云调试日志
  if (site === 'cloud.tencent.com') {
    const matched = config.contentSelectors.filter((sel) => $(sel).length > 0);
    console.log(`[extractor] cloud.tencent.com selectors matched: ${matched.join(', ')}`);
  }

  // ===== 1. 选择正文容器 =====
  let $content: any = null;
  let bestScore = -Infinity;

  if (config.contentSelectors.length > 0) {
    for (const sel of config.contentSelectors) {
      $(sel).each((_: number, el: any) => {
        const $el = $(el);
        const textLen = ($el.text() || '').trim().length;
        if (textLen <= 50) return;
        const score = scoreContainer($el, config);
        if (score > bestScore) {
          bestScore = score;
          $content = $el;
        }
      });
    }
  }

  // CSDN 特例
  if (site === 'csdn.net') {
    const $cv = $('#content_views');
    const cvText = ($cv.text() || '').trim().length;
    if ($cv.length && cvText > 50) {
      $content = $cv;
      bestScore = Infinity;
    }
  }

  // 未命中 → 通用 body 扫描
  if (!$content || bestScore === -Infinity) {
    $content = fallbackPickContainer($, url);
  }

  // 仍未找到 → 兜底
  if (!$content) {
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    return {
      title: extractTitle($, config),
      contentHtml: '',
      text: bodyText,
      site,
      imgUrls: [],
    };
  }

  // ===== 2. 清理噪音 =====
  const cleanup = Array.from(new Set([...BASE_NOISE_SELECTORS, ...config.cleanupSels]));
  for (const sel of cleanup) {
    $content.find(sel).remove();
  }

  // ===== 2.5 知乎额外清理 =====
  if (site === 'zhihu.com') {
    removeZhihuEmbeddedNoise($, $content);
  }

  // ===== 3. 可选文本密度优化 =====
  if (config.enableDensityOptimization) {
    applyDensityOptimization($, $content, config.blockTagThreshold ?? 8);
  }

  // ===== 3.5 CSDN 代码块归一化 =====
  if (site === 'csdn.net') {
    normalizeCsdnCodeBlocks($, $content);
  }

  // ===== 4. 处理图片 =====
  const imgUrls = processImages($, $content, url);

  // ===== 5. 输出 =====
  let contentHtml = ($content.html() || '').trim();
  let text = ($content.text() || '').replace(/\s+/g, ' ').trim();

  if (site === 'zhihu.com') {
    text = postProcessZhihuText(text);
    contentHtml = postProcessZhihuHtml(contentHtml);
  }

  return {
    title: extractTitle($, config),
    contentHtml,
    text,
    site,
    imgUrls,
  };
}
