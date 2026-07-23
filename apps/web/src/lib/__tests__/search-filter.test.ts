/**
 * 测试：搜索过滤规则
 */
import { describe, it, expect } from 'vitest';
import { applyFiltersServer } from '@/lib/search-filter';
import type { SearchFilterRule } from '@/lib/search-filter';

interface Result {
  title: string;
  url: string;
  snippet?: string;
}

const sampleResults: Result[] = [
  { title: '如何使用 React 开发', url: 'https://zhuanlan.zhihu.com/p/123', snippet: 'React 入门教程' },
  { title: 'React 官方文档', url: 'https://react.dev', snippet: 'React 官方文档' },
  { title: 'GitHub - react', url: 'https://github.com/facebook/react', snippet: 'React 仓库' },
  { title: '欢迎使用 React', url: 'https://example.com/welcome', snippet: '示例页面' },
  { title: 'React 入门 - CSDN', url: 'https://blog.csdn.net/react/article/details/123', snippet: 'CSDN 教程' },
  { title: 'Index of /react/', url: 'https://example.com/react/', snippet: '目录列表' },
  { title: '登录 - React 管理后台', url: 'https://admin.example.com/login', snippet: '请登录' },
  { title: 'React 文档', url: 'https://react.doc.com/docs', snippet: '文档首页' },
  { title: 'Bing 缓存页', url: 'https://cc.bingj.com/cache.aspx?d=1', snippet: '缓存内容' },
  { title: 'React 最佳实践', url: 'https://juejin.cn/post/123456', snippet: '掘金文章' },
];

describe('applyFiltersServer', () => {
  it('空规则返回全部结果', () => {
    const result = applyFiltersServer(sampleResults, []);
    expect(result).toEqual(sampleResults);
  });

  it('过滤域名黑名单', () => {
    const rules: SearchFilterRule[] = [
      { id: 't1', type: 'domain', pattern: 'example.com', enabled: true, note: '' },
    ];
    const result = applyFiltersServer(sampleResults, rules);
    expect(result.find((r) => r.url.includes('example.com'))).toBeUndefined();
    expect(result.length).toBeLessThan(sampleResults.length);
  });

  it('过滤关键词黑名单', () => {
    const rules: SearchFilterRule[] = [
      { id: 't1', type: 'keyword', pattern: '登录|sign in', enabled: true, note: '' },
    ];
    const result = applyFiltersServer(sampleResults, rules);
    expect(result.find((r) => r.title.includes('登录'))).toBeUndefined();
  });

  it('过滤 `Index of` 标题', () => {
    const rules: SearchFilterRule[] = [
      { id: 't1', type: 'keyword', pattern: '^index of', enabled: true, note: '' },
    ];
    const result = applyFiltersServer(sampleResults, rules);
    expect(result.find((r) => r.title.toLowerCase().startsWith('index of'))).toBeUndefined();
  });

  it('disabled 规则不生效', () => {
    const rules: SearchFilterRule[] = [
      { id: 't1', type: 'domain', pattern: 'example.com', enabled: false, note: '' },
    ];
    const result = applyFiltersServer(sampleResults, rules);
    expect(result.find((r) => r.url.includes('example.com'))).toBeDefined();
  });

  it('组合规则：同时过滤多个', () => {
    const rules: SearchFilterRule[] = [
      { id: 't1', type: 'domain', pattern: 'example.com', enabled: true, note: '' },
      { id: 't2', type: 'keyword', pattern: '登录', enabled: true, note: '' },
      { id: 't3', type: 'keyword', pattern: '^index of', enabled: true, note: '' },
    ];
    const result = applyFiltersServer(sampleResults, rules);
    expect(result.length).toBe(7); // 10 - 3 = 7
  });

  it('hostname 前缀匹配', () => {
    const rules: SearchFilterRule[] = [
      { id: 't1', type: 'domain', pattern: 'cc.bingj.com', enabled: true, note: '' },
    ];
    const result = applyFiltersServer(sampleResults, rules);
    expect(result.find((r) => r.url.includes('cc.bingj.com'))).toBeUndefined();
  });

  it('无效 URL 不报错', () => {
    const items: Result[] = [
      { title: 'invalid', url: 'not-a-url' },
      { title: 'valid', url: 'https://example.com/page' },
    ];
    const rules: SearchFilterRule[] = [
      { id: 't1', type: 'domain', pattern: 'example.com', enabled: true, note: '' },
    ];
    const result = applyFiltersServer(items, rules);
    expect(result.length).toBe(1); // invalid URL passes through
    expect(result[0].url).toBe('not-a-url');
  });
});
