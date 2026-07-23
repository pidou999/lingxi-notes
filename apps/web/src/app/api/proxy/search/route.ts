/**
 * 三引擎并行搜索 API
 *
 * Bing + 百度 + DuckDuckGo，合并去重后返回真实搜索结果。
 * 优先级：Bing（英文质量高） > 百度（中文质量高） > DuckDuckGo（备用）
 *
 * 拆分说明：2026-07-18 原 20KB 大文件拆分为
 * - route.ts           — 路由入口：合并去重过滤
 * - bing.ts            — Bing 搜索逻辑
 * - baidu.ts           — 百度搜索逻辑
 * - ddg.ts             — DuckDuckGo 搜索逻辑
 * - utils.ts           — normalizeUrl / filterSearchResults / stripHtml
 * - types.ts           — SearchResult 类型
 */
import { NextRequest, NextResponse } from 'next/server';
import { searchBing } from './bing';
import { searchBaidu } from './baidu';
import { searchDuckDuckGo } from './ddg';
import { normalizeUrl, filterSearchResults } from './utils';
import type { SearchResult } from './types';
import { applyFiltersServer } from '@/lib/search-filter';
import type { SearchFilterRule } from '@/lib/search-filter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { q, filters: rawFilters } = body;
    if (!q || typeof q !== 'string' || !q.trim()) {
      return NextResponse.json({ error: '缺少搜索关键词' }, { status: 400 });
    }

    const query = q.trim();

    // 三引擎并行
    const [bingSet, baiduSet, ddgSet] = await Promise.allSettled([
      searchBing(query),
      searchBaidu(query),
      searchDuckDuckGo(query),
    ]);

    const allResults: SearchResult[] = [];
    const errors: string[] = [];

    if (bingSet.status === 'fulfilled') allResults.push(...bingSet.value);
    else errors.push(`Bing: ${bingSet.reason?.message || bingSet.reason}`);

    if (baiduSet.status === 'fulfilled') allResults.push(...baiduSet.value);
    else errors.push(`Baidu: ${baiduSet.reason?.message || baiduSet.reason}`);

    if (ddgSet.status === 'fulfilled') allResults.push(...ddgSet.value);
    else errors.push(`DuckDuckGo: ${ddgSet.reason?.message || ddgSet.reason}`);

    console.log(
      '[proxy/search] raw counts — Bing: %d, Baidu: %d, DuckDuckGo: %d',
      bingSet.status === 'fulfilled' ? bingSet.value.length : 0,
      baiduSet.status === 'fulfilled' ? baiduSet.value.length : 0,
      ddgSet.status === 'fulfilled' ? ddgSet.value.length : 0,
    );

    // 去重
    const seenUrls = new Set<string>();
    const deduped: SearchResult[] = [];
    for (const r of allResults) {
      const key = normalizeUrl(r.url);
      if (key && !seenUrls.has(key)) {
        seenUrls.add(key);
        deduped.push(r);
      }
    }

    if (deduped.length === 0) {
      return NextResponse.json(
        { error: '所有搜索引擎均返回空结果', details: errors.join('; ') },
        { status: 502 },
      );
    }

    // 内置规则过滤
    const builtinFiltered = filterSearchResults(deduped);

    // 用户可配置规则过滤（从请求中传递）
    let userRules: SearchFilterRule[] = [];
    if (rawFilters) {
      try {
        userRules = typeof rawFilters === 'string' ? JSON.parse(rawFilters) : rawFilters;
      } catch {
        // 忽略格式错误
      }
    }
    const final = userRules.length > 0
      ? applyFiltersServer(builtinFiltered, userRules)
      : builtinFiltered;

    console.log(
      '[proxy/search] deduped: %d, builtin-filtered: %d, user-filtered: %d, removed: %d',
      deduped.length,
      builtinFiltered.length,
      final.length,
      deduped.length - final.length,
    );

    return NextResponse.json({
      results: final,
      filteredCount: deduped.length - final.length,
      totalRaw: deduped.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: '搜索失败: ' + msg.slice(0, 200) }, { status: 500 });
  }
}
