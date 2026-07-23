/**
 * 通用兜底配置 + 全局基础噪音选择器
 *
 * 与 SITE_CONFIGS 解耦，放入独立模块方便维护。
 */
import type { SiteConfig } from './index';

/** 触发浏览器兜底的状态码（含 CSDN 521 WAF 拦截、知乎 999 等） */
export const FALLBACK_STATUS_CODES: number[] = [403, 429, 500, 502, 503, 521, 999];

/** 提取文本最短长度阈值，低于此值视为「内容过短/选错容器」并触发兜底 */
export const MIN_CONTENT_LENGTH: number = 500;

// ====== 全局基础噪音选择器 ======

/**
 * 所有站点通用的基础噪音选择器，与站点专属 cleanupSels 合并后统一清理。
 * 覆盖：脚本/样式/导航/侧栏/评论/广告/页脚/作者/归档/相关推荐等。
 */
export const BASE_NOISE_SELECTORS: string[] = [
  'script',
  'style',
  'nav',
  'button',
  'svg',
  'path',
  'footer',
  '.footer',
  'header',
  '.header',
  'input',
  'form',
  'iframe',
  'aside',
  '.ad',
  '.advertisement',
  '.adsbygoogle',
  '.share',
  '.social-share',
  '.recommend',
  '.comment',
  '#comment',
  '.comments',
  '.related',
  '.sidebar',
  // 技术文档站 / 通用站噪音
  '.toc',
  '.table-of-contents',
  '.breadcrumb',
  '.breadcrumbs',
  '.pagination',
  '.page-nav',
  '.toolbar',
  '.action-bar',
  '.rating',
  '.vote',
  '.tag-list',
  '.tag-cloud',
  '.author-info',
  '.author-card',
  '.subscribe',
  '.follow-btn',
  '.qr-code',
  '.wechat-qr',
  '.copy-btn',
  '.clipboard-btn',
  '.tooltip',
  '.popover',
  '.modal',
  '.dialog',
  '.overlay',
  // 属性选择器匹配噪音
  '[class*="sidebar"]',
  '[class*="Sidebar"]',
  '[class*="recommend"]',
  '[class*="Related"]',
  '[class*="comment"]',
  '[id*="comment"]',
  // 通用噪音扩展
  '.related-posts',
  '.recommended-posts',
  '.post-navigation',
  '.entry-meta',
  '.post-meta',
  '.meta-info',
  '#footer',
  '#colophon',
  // 腾讯云 / 通用站 导航、归档、领券、作者区清理
  '.site-header',
  '.site-nav',
  '.site-footer',
  '.coupon',
  '.promotion',
  '[class*="promo"]',
  '.article-footer',
  '.article-meta',
  '.archives',
  '.archive',
  // 博客园导航/作者/页脚通用清理
  '.blognav',
  '.nav-menu',
  '#navList',
  '.authorProfile',
  // 常见底部噪音/推荐/声明
  '.read-more',
  '.hot-list',
  '.hot-news',
  '.recommend-news',
  '.newest-news',
  '.copyright',
  '.declaration',
  '.copy-right',
  '.qrcode',
  '.QRcode',
  '.praise',
  '.reward',
  '.donate',
  '.appreciate',
];

/**
 * 通用兜底配置（hostname 未命中 SITE_CONFIGS 时使用）。
 * 取常见正文容器，启用密度优化以保护结构化正文。
 */
export const FALLBACK_CONFIG: SiteConfig = {
  contentSelectors: ['article', '.post-content', '.entry-content', '.content', 'main', '#content'],
  cleanupSels: [],
  enableDensityOptimization: true,
  blockTagThreshold: 8,
  titleSelectors: ['h1', '.title', '.article-title', '.post-title'],
};
