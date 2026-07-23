"use client";

import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { Close, Save, FileText, Note, ExternalLink, Loader2 } from "@ai-notes/icons";
import { createNote, updateNote } from "@/lib/storage";
import { getCookieForUrl } from "@/lib/cookies";

/** 单条网页搜索结果 */
interface WebSearchItem {
  title: string;
  /** 一句话摘要 */
  summary: string;
  /** 详细内容（3-5段完整介绍） */
  detail: string;
  /** 来源URL（可能为空） */
  url: string;
  source?: string;
}

/** 抓取到的网页原文 */
interface FetchedPage {
  html: string;
  title: string;
}

interface ResultModalProps {
  open: boolean;
  onClose: () => void;
  /** 笔记搜索结果 */
  note?: { title: string; html: string; tags?: string[] };
  /** 网页搜索结果 — 单条（兼容旧格式） */
  webResult?: { title: string; content: string; url?: string };
  /** 网页搜索结果 — 多结果列表（新格式） */
  webResults?: WebSearchItem[];
}

/** 将纯文本转为 HTML（处理换行、链接等） */
function textToHtml(text: string): string {
  if (!text) return "";
  return text
    // URL 自动变链接
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    // 换行分段
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>")
    // 包裹段落
    .replace(/^(.+)$/gm, (match) => {
      // 已经是 HTML 标签的不处理
      if (match.startsWith("<")) return match;
      return match;
    });
}

/** 净化外部/不可信 HTML，防止存储型 XSS（getDisplayHtml 会渲染抓取的网页原文） */
function sanitizeHtml(html: string): string {
  if (typeof window === "undefined" || !html) return html;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function ResultModal({ open, onClose, note, webResult, webResults }: ResultModalProps) {
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  /** 当前选中的网页结果索引 */
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  /** 已抓取的原文内容 (url -> FetchedPage) */
  const [fetchedPages, setFetchedPages] = useState<Record<string, FetchedPage>>({});
  /** 正在加载的 URL */
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});
  /** 加载错误信息 */
  const [fetchErrors, setFetchErrors] = useState<Record<string, string>>({});
  /** 知乎反爬拦截的 URL 集合 */
  const [zhihuBlockedUrls, setZhihuBlockedUrls] = useState<Record<string, boolean>>({});
  /** 是否正在显示原文模式（而非AI详细内容） */
  const [showFullPage, setShowFullPage] = useState<Record<string, boolean>>({});

  // 每次打开或结果变化时重置状态
  useEffect(() => {
    if (open) {
      setSavedMap({});
      setSelectedIdx(webResults && webResults.length > 0 ? 0 : -1);
    } else {
      setFetchedPages({});
      setLoadingUrls({});
      setFetchErrors({});
      setZhihuBlockedUrls({});
      setShowFullPage({});
    }
  }, [open, webResults]);

  /** 抓取网页原文 */
  const fetchPageContent = useCallback(async (url: string) => {
    if (!url || fetchedPages[url] || loadingUrls[url]) return;

    setLoadingUrls((prev) => ({ ...prev, [url]: true }));
    setFetchErrors((prev) => {
      const next = { ...prev };
      delete next[url];
      return next;
    });

    try {
      // 知乎链接：自动获取已配置的 Cookie
      const cookie = url.includes("zhihu.com") ? getCookieForUrl(url) : undefined;
      const resp = await fetch("/api/proxy/fetch-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, cookie }),
      });

      const data = await resp.json();

      if (!resp.ok || data.error) {
        // 知乎反爬：标记为 zhihuBlocked，前端不重试加载原文
        if (data.zhihuBlocked) {
          setZhihuBlockedUrls((prev) => ({ ...prev, [url]: true }));
        }
        setFetchErrors((prev) => ({
          ...prev,
          [url]: data.error || `请求失败 (${resp.status})`,
        }));
        return;
      }

      setFetchedPages((prev) => ({
        ...prev,
        [url]: { html: data.html, title: data.title },
      }));

      // 加载成功后自动切换到原文模式
      setShowFullPage((prev) => ({ ...prev, [url]: true }));
    } catch (e) {
      setFetchErrors((prev) => ({
        ...prev,
        [url]: e instanceof Error ? e.message : "网络请求失败",
      }));
    } finally {
      setLoadingUrls((prev) => ({ ...prev, [url]: false }));
    }
  }, [fetchedPages, loadingUrls]);

  if (!open) return null;

  /** 判断当前是否为多结果列表模式 */
  const isMultiMode = !!(webResults && webResults.length > 0);

  /** 获取当前展示的内容 */
  const currentItem = isMultiMode
    ? (selectedIdx >= 0 ? webResults[selectedIdx] : null)
    : null;

  const currentTitle = isMultiMode
    ? currentItem?.title || ""
    : webResult?.title || "";

  const currentUrl = isMultiMode
    ? currentItem?.url || ""
    : webResult?.url || "";

  /** 判断 URL 是否有效（非空且非占位符） */
  const hasValidUrl = currentUrl && currentUrl !== "https://example.com" && currentUrl !== "https://example.com/";

  /** 获取当前URL的原文状态 */
  const currentFetched = currentUrl ? fetchedPages[currentUrl] : undefined;
  const currentLoading = currentUrl ? !!loadingUrls[currentUrl] : false;
  const currentError = currentUrl ? fetchErrors[currentUrl] : undefined;
  const isShowingFull = currentUrl ? !!showFullPage[currentUrl] : false;

  /** 给 HTML 中的 table 标签注入 inline 样式，确保表格正确渲染 */
  const styleTables = (html: string): string => {
    if (!html || !html.includes('<table')) return html;
    const tableStyle = 'width:100%;border-collapse:collapse;margin:1em 0;font-size:0.875em;';
    const thStyle = 'font-weight:600;text-align:left;padding:8px 12px;border-bottom:2px solid var(--color-border);background-color:var(--color-surface-secondary);white-space:nowrap;';
    const tdStyle = 'padding:8px 12px;border-bottom:1px solid var(--color-border);vertical-align:top;';
    return html
      .replace(/<table([^>]*)>/g, `<table$1 style="${tableStyle}">`)
      .replace(/<th([^>]*)>/g, `<th$1 style="${thStyle}">`)
      .replace(/<td([^>]*)>/g, `<td$1 style="${tdStyle}">`);
  };

  /** 获取展示内容：优先原文 > detail > summary */
  const getDisplayHtml = (): string => {
    let html = '';
    if (isShowingFull && currentFetched) {
      html = currentFetched.html;
    } else if (isMultiMode && currentItem) {
      if (currentItem.detail) {
        html = textToHtml(currentItem.detail);
      } else if (currentItem.summary) {
        html = `<p>${currentItem.summary}</p>`;
      }
    } else if (webResult?.content) {
      html = textToHtml(webResult.content);
    }
    return styleTables(html);
  };

  /** 获取展示标题 */
  const getDisplayTitle = (): string => {
    if (isShowingFull && currentFetched) {
      return currentFetched.title || currentTitle;
    }
    return currentTitle;
  };

  /** 保存笔记 */
  const handleSaveSingle = (item: WebSearchItem | null, idx: number) => {
    if (!item) return;
    const key = `web-${idx}`;
    if (savedMap[key]) return;

    const fetched = item.url ? fetchedPages[item.url] : undefined;

    // 优先保存原文，其次保存详细内容，最后保存摘要
    let html: string;
    let saveTitle: string;

    if (isShowingFull && fetched) {
      // 有原文 → 保存完整原文
      saveTitle = fetched.title || item.title;
      html = `<h1>${saveTitle}</h1>
${item.source ? `<blockquote>来源：${item.source}</blockquote>` : ""}
${item.url ? `<blockquote>原文链接：<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url}</a></blockquote>` : ""}
${fetched.html}`;
    } else if (item.detail) {
      // 有详细内容 → 保存详细内容
      saveTitle = item.title;
      html = `<h1>${item.title}</h1>
${item.source ? `<blockquote>来源：${item.source}</blockquote>` : ""}
${item.url ? `<blockquote>参考链接：<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url}</a></blockquote>` : ""}
${textToHtml(item.detail)}`;
    } else {
      // 只有摘要
      saveTitle = item.title;
      html = `<h1>${item.title}</h1>
${item.source ? `<blockquote>来源：${item.source}</blockquote>` : ""}
${item.url ? `<blockquote>链接：<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url}</a></blockquote>` : ""}
<p>${item.summary}</p>`;
    }

    const noteObj = createNote(saveTitle);
    updateNote(noteObj.id, { html, tags: ["网络搜索"] });
    setSavedMap((prev) => ({ ...prev, [key]: true }));
    window.dispatchEvent(new Event("ai-notes:note-changed"));
  };

  const handleOpenLink = (url: string) => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  /** 切换原文/内容视图 */
  const toggleFullPage = (url: string) => {
    if (showFullPage[url]) {
      // 切回AI内容
      setShowFullPage((prev) => ({ ...prev, [url]: false }));
    } else {
      // 如果还没加载过，先加载
      if (!fetchedPages[url]) {
        fetchPageContent(url);
      } else {
        setShowFullPage((prev) => ({ ...prev, [url]: true }));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
      <div className="mx-4 flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            {note ? (
              <FileText size={18} className="text-brand-500" />
            ) : (
              <Note size={18} className="text-blue-500" />
            )}
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {note ? "📝 笔记" : "🌐 网络搜索结果"}
            </span>
            {isMultiMode && (
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                {webResults!.length} 条结果
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="关闭"
          >
            <Close size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* 多结果导航栏 */}
          {isMultiMode && (
            <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {webResults!.map((item, idx) => {
                  const key = `web-${idx}`;
                  const hasFull = !!(item.url && fetchedPages[item.url]);
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedIdx(idx)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        selectedIdx === idx
                          ? "bg-brand-600 text-white"
                          : savedMap[key]
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 line-through decoration-green-500"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      }`}
                    >
                      {hasFull && "📄 "}
                      {item.title.slice(0, 20)}{item.title.length > 20 ? "..." : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 内容区域 */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
            {/* 笔记模式 */}
            {!isMultiMode && note && (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.html) }} />
              </div>
            )}

            {/* 旧单条webResult模式 */}
            {!isMultiMode && webResult && (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <h1>{webResult.title}</h1>
                <blockquote>来源：AI 网络搜索</blockquote>
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(textToHtml(webResult.content)) }} />
              </div>
            )}

            {/* 多结果模式 — 详情面板 */}
            {isMultiMode && (
              <>
                {currentItem ? (
                  <div className="flex flex-col gap-3">
                    {/* 标题行 */}
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {getDisplayTitle()}
                      </h2>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {currentItem.source && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            {currentItem.source}
                          </span>
                        )}
                        {isShowingFull && currentFetched && (
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-600 dark:bg-green-900/30 dark:text-green-400">
                            原文
                          </span>
                        )}
                        {!isShowingFull && currentItem.detail && (
                          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                            AI 详解
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 加载中 */}
                    {currentLoading && (
                      <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                        <Loader2 size={16} className="animate-spin" />
                        正在加载原文内容...
                      </div>
                    )}

                    {/* 知乎反爬提示 */}
                    {currentUrl && zhihuBlockedUrls[currentUrl] && (
                      <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                        <div className="flex items-start gap-2">
                          <span>ℹ️</span>
                          <div>
                            <p>知乎抓取失败：<strong>{currentError || '需要配置 Cookie'}</strong></p>
                            <p className="mt-1">
                              <a href="/settings" className="font-medium underline hover:no-underline"
                                onClick={(e) => { e.stopPropagation(); }}>
                                配置知乎 Cookie
                              </a>
                              ，或在浏览器中直接打开链接。
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 加载错误（非知乎反爬） */}
                    {currentError && !currentLoading && !zhihuBlockedUrls[currentUrl] && (
                      <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                        ⚠️ 加载原文失败：{currentError}（当前显示 AI 提供的详细内容）
                      </div>
                    )}

                    {/* 正文内容 */}
                    {!currentLoading && (
                      <div
                        className="prose prose-sm max-w-none dark:prose-invert rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(getDisplayHtml()) }}
                      />
                    )}

                    {/* 操作按钮 */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {/* 加载原文（仅当有有效URL且非知乎反爬时显示） */}
                      {hasValidUrl && !zhihuBlockedUrls[currentUrl] && (
                        <button
                          onClick={() => toggleFullPage(currentUrl)}
                          disabled={currentLoading}
                          className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                        >
                          {currentLoading ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              加载中...
                            </>
                          ) : isShowingFull && currentFetched ? (
                            <>🤖 查看 AI 详解</>
                          ) : (
                            <>📄 加载原文</>
                          )}
                        </button>
                      )}

                      {/* 打开原链接（仅当有URL时显示） */}
                      {hasValidUrl && (
                        <button
                          onClick={() => handleOpenLink(currentUrl)}
                          className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                          <ExternalLink size={12} />
                          打开原链接
                        </button>
                      )}

                      {/* 保存到笔记 */}
                      <button
                        onClick={() => handleSaveSingle(currentItem, selectedIdx)}
                        disabled={!!savedMap[`web-${selectedIdx}`]}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                      >
                        <Save size={12} />
                        {savedMap[`web-${selectedIdx}`]
                          ? "已保存"
                          : isShowingFull && currentFetched
                            ? "保存原文到笔记"
                            : "保存到笔记"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
                    请选择上方的一条结果查看详情
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
            {isMultiMode && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                共 {webResults!.length} 条搜索结果 · 展示 AI 提供的详细内容{hasValidUrl ? " · 点击「📄 加载原文」查看网页原文" : ""}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
