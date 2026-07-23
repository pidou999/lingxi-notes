/**
 * Bing HTML 搜索
 *
 * 最高优先级引擎。通过解析 Bing 搜索结果页 HTML 提取标题+URL+摘要。
 */
import { stripHtml } from './utils';
import type { SearchResult } from './types';

export async function searchBing(query: string): Promise<SearchResult[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!resp.ok) throw new Error(`Bing 返回 ${resp.status}`);
  return parseBingHtml(await resp.text());
}

function parseBingHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const algoBlocks = html.match(/<li\s+class="b_algo"[^>]*>[\s\S]*?<\/li>/g);
  if (!algoBlocks) return results;

  for (const block of algoBlocks) {
    try {
      let title = '';
      let url = '';

      const h2Link = block.match(
        /<h2[^>]*>[\s\S]*?<a\s+[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/,
      );
      if (h2Link) {
        url = h2Link[1];
        title = stripHtml(h2Link[2]).trim();
      }

      if (!url) {
        const fallback = block.match(/<a\s+[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        if (fallback) {
          url = fallback[1];
          title = stripHtml(fallback[2]).trim();
        }
      }

      if (!title || !url) continue;
      if (url.includes('bing.com/search') || url.includes('bing.com/')) continue;

      let snippet = '';
      const snip = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
      if (snip) snippet = stripHtml(snip[1]).trim();

      results.push({ title, url, snippet, source: 'Bing' });
    } catch {
      /* skip */
    }
  }

  return results.slice(0, 20);
}
