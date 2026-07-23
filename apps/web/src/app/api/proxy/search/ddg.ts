/**
 * DuckDuckGo Lite HTML 搜索
 *
 * 第三优先级引擎（备用）。通过解析 DuckDuckGo Lite 页面提取结果。
 */
import { stripHtml } from './utils';
import type { SearchResult } from './types';

export async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!resp.ok) throw new Error(`DuckDuckGo 返回 ${resp.status}`);
  return parseDuckDuckGoHtml(await resp.text());
}

function parseDuckDuckGoHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  const resultBlocks = html.match(
    /<div\s+class="result\s+results_links[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g,
  );

  if (!resultBlocks) return results;

  for (const block of resultBlocks) {
    try {
      if (
        /class="[^"]*result--ad[^"]*"/i.test(block) ||
        /class="[^"]*result--sponsored[^"]*"/i.test(block)
      ) {
        continue;
      }

      const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      if (!titleMatch) continue;
      const title = stripHtml(titleMatch[1]).trim();
      if (!title) continue;

      let url = '';
      const urlMatch = block.match(/uddg=([^&"'\s]+)/);
      if (urlMatch) url = decodeURIComponent(urlMatch[1]);
      if (!url) {
        const hrefMatch = block.match(/href="(https?:\/\/[^"]+)"/);
        if (hrefMatch) url = hrefMatch[1];
      }
      if (!url || url === 'https://duckduckgo.com/' || url === 'https://duckduckgo.com') continue;

      let snippet = '';
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      if (snippetMatch) snippet = stripHtml(snippetMatch[1]).trim();

      if (
        snippet.includes(
          "We would like to show you a description here but the site won't allow us",
        )
      ) {
        snippet = '';
      }

      results.push({ title, url, snippet, source: 'DuckDuckGo' });
    } catch {
      /* skip */
    }
  }

  return results.slice(0, 10);
}
