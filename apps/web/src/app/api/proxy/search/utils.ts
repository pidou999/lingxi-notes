/**
 * 搜索工具函数
 *
 * stripHtml / normalizeUrl / filterSearchResults / isDocLandingPage
 */

// ====== 已知站点与路径模式 ======

/** 已知常见技术内容站点 */
export const KNOWN_TECH_HOSTS = new Set([
  'zhihu.com',
  'csdn.net',
  'cnblogs.com',
  'cloud.tencent.com',
  'juejin.cn',
  'segmentfault.com',
  'oschina.net',
  'infoq.cn',
  'infoq.com',
  'developer.aliyun.com',
  'learnku.com',
  'imooc.com',
  'bilibili.com',
  'weixin.qq.com',
  'mp.weixin.qq.com',
  'jianshu.com',
  '51cto.com',
]);

/** 文章/正文路径标识符 */
const CONTENT_PATH_PATTERNS = [
  /\/p\//,
  /\/article\//,
  /\/post\//,
  /\/posts\//,
  /\/details\//,
  /\/doc\//,
  /\/docs\//,
  /\/blog\//,
  /\/blogs\//,
  /\/questions\//,
  /\/question\//,
  /\/wiki\//,
  /\/show\//,
  /\/item\//,
  /\/read\//,
  /\/tutorial\//,
  /\/guide\//,
  /\/download\//,
  /\/download\?id=/,
];

/** 官方文档站 host */
const DOC_SITE_HOSTS = [
  'gofrp.org',
  'readthedocs.io',
  'readthedocs.org',
  'gitbook.io',
  'docsify.js.org',
  'vuepress.vuejs.org',
];

// ====== 工具函数 ======

/** 去除 HTML 标签并解码实体 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&ensp;/g, ' ')
    .replace(/&emsp;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 归一化 URL 用于去重 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    let hostname = u.hostname.replace(/^www\./, '');
    let pathname = u.pathname.replace(/\/$/, '');
    const params = new URLSearchParams(u.search);
    params.delete('utm_source');
    params.delete('utm_medium');
    params.delete('utm_campaign');
    params.delete('utm_content');
    params.delete('utm_term');
    params.delete('ref');
    const qs = params.toString();
    return hostname + pathname + (qs ? '?' + qs : '');
  } catch {
    return url;
  }
}

/**
 * 判断是否为官方文档站落地页/文档索引页。
 */
function isDocLandingPage(hostname: string, pathname: string, title: string): boolean {
  const p = pathname.replace(/\/$/, '').toLowerCase();
  const t = (title || '').trim().toLowerCase();
  const depth = p.split('/').filter(Boolean).length;

  if (DOC_SITE_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h))) {
    if (depth <= 2) return true;
    if (/\/docs?$/.test(p) || /\/(zh-cn|zh|en|cn)\/docs?$/.test(p)) return true;
  }

  if (/\/(docs?|documentation)$/.test(p)) return true;
  if (/^文档\s*[\-—|·]/.test(t)) return true;
  if (/^doc(umentation)?s?\b/.test(t)) return true;

  return false;
}

/**
 * 过滤搜索结果：首页、GitHub 根页、官方文档 landing、过浅路径。
 * 过滤后过少则回退宽松版本。
 */
export function filterSearchResults(results: { title: string; url: string }[]): typeof results {
  const strict = results.filter((r) => {
    try {
      const u = new URL(r.url);
      const hostname = u.hostname.replace(/^www\./, '');
      const pathname = u.pathname.replace(/\/$/, '');

      // GitHub 根页过滤
      if (hostname === 'github.com' || hostname.endsWith('.github.com')) {
        const pathSegments = pathname.split('/').filter(Boolean);
        return pathSegments.length >= 3;
      }

      // 首页过滤
      if (pathname === '' || /^\/(?:index|home|default)(?:\.html?)?$/i.test(pathname)) {
        return false;
      }

      // 官方文档 landing
      if (isDocLandingPage(hostname, pathname, r.title)) return false;

      // 已知技术站点：深度 >= 1 保留
      if (KNOWN_TECH_HOSTS.has(hostname) || KNOWN_TECH_HOSTS.has(hostname.replace(/^[^.]+\./, ''))) {
        return pathname.split('/').filter(Boolean).length >= 1;
      }

      // 优先保留含文章标识的路径
      const isContentPath = CONTENT_PATH_PATTERNS.some((p) => p.test(pathname));
      if (!isContentPath) {
        const depth = pathname.split('/').filter(Boolean).length;
        if (depth < 2) return false;
      }

      const titleClean = (r.title || '').trim().toLowerCase();
      if (/^文档[\s\-—]/.test(titleClean)) return false;
      if (/^doc(umentation)?s?\b/i.test(titleClean)) return false;

      return true;
    } catch {
      return true;
    }
  });

  if (strict.length >= 8) return strict;

  const loose = results.filter((r) => {
    try {
      const u = new URL(r.url);
      const hostname = u.hostname.replace(/^www\./, '');
      const pathname = u.pathname.replace(/\/$/, '');

      if (hostname === 'github.com' || hostname.endsWith('.github.com')) {
        return pathname.split('/').filter(Boolean).length >= 3;
      }
      if (pathname === '' || /^\/(?:index|home|default)(?:\.html?)?$/i.test(pathname)) return false;
      if (isDocLandingPage(hostname, pathname, r.title)) return false;
      return true;
    } catch {
      return true;
    }
  });

  return loose.length > strict.length ? loose : strict;
}
