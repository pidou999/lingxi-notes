/**
 * 百度 HTML 搜索
 *
 * 第二优先级引擎（中文搜索质量好）。
 * 通过解析百度搜索结果页 HTML 提取标题+URL+摘要。
 */
import { stripHtml } from './utils';
import type { SearchResult } from './types';

export async function searchBaidu(query: string): Promise<SearchResult[]> {
  const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      Referer: 'https://www.baidu.com/',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!resp.ok) throw new Error(`百度返回 ${resp.status}`);
  return parseBaiduHtml(await resp.text());
}

function parseBaiduHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  const contentMatch = html.match(
    /<div[^>]*\sid="content_left"[^>]*>([\s\S]*?)(?:<\/div>\s*<div[^>]*\sid="content_right"|<div[^>]*\sclass="c-container")/,
  );
  const contentHtml = contentMatch ? contentMatch[1] : html;

  const resultBlocks = contentHtml.match(
    /<div\s+[^>]*class="[^"]*(?:result\s+)?c-container[^"]*"[^>]*>[\s\S]*?(?=<div\s+[^>]*class="[^"]*(?:result\s+)?c-container|$)/g,
  );

  if (!resultBlocks) return results;

  for (const block of resultBlocks) {
    try {
      const titleMatch = block.match(
        /<h3[^>]*class="t"[^>]*>[\s\S]*?<a\s+[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/,
      );
      if (!titleMatch) continue;

      const url = titleMatch[1];
      const title = stripHtml(titleMatch[2]).trim();
      if (!title || !url) continue;

      if (url.includes('baidu.com/s?') || url.includes('baidu.com/link?url=javascript') || url.includes('baike.baidu.com/item')) continue;

      let snippet = '';
      const abstractMatch = block.match(
        /<(?:span|div)[^>]*class="[^"]*(?:c-abstract|content-right)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      );
      if (abstractMatch) snippet = stripHtml(abstractMatch[1]).trim();

      if (!snippet) {
        const spanMatch = block.match(/<div[^>]*class="[^"]*c-span-last[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (spanMatch) snippet = stripHtml(spanMatch[1]).trim();
      }
      if (!snippet) {
        const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
        if (pMatch) snippet = stripHtml(pMatch[1]).trim();
      }
      if (!snippet) {
        const textMatch = block.match(
          /class="[^"]*(?:content|desc|abstract|text)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|p)>/,
        );
        if (textMatch) snippet = stripHtml(textMatch[1]).trim();
      }

      results.push({ title, url, snippet, source: 'Baidu' });
    } catch {
      /* skip */
    }
  }

  return results.slice(0, 10);
}
