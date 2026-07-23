/**
 * 搜索类型定义
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'Bing' | 'Baidu' | 'DuckDuckGo';
}
