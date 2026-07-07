"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { Button } from "@ai-notes/ui-kit";
import {
  Note as NoteIcon,
  ExternalLink,
  Loader2,
  CheckCircle,
  XCircle,
  Ai,
  ChevronDown,
} from "@ai-notes/icons";
import { getCookieForUrl } from "@/lib/cookies";
import { getProviders, chatCompletion, summaryPrompt } from "@/lib/providers";
import type { ProviderConfig } from "@/lib/providers";

// 从 URL 中提取可读域名
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface ClipResult {
  title: string;
  content: string;
  url: string;
  success: boolean;
  summary?: string;
}

export function ClipDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (result: ClipResult) => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ClipResult | null>(null);
  const [providers, setLocalProviders] = useState<ProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 加载 providers
  useEffect(() => {
    const list = getProviders().filter((p) => p.models.length > 0);
    setLocalProviders(list);
    if (list.length > 0) {
      setSelectedProvider(list[0]);
      setSelectedModel(list[0].models[0] || "");
    }
  }, [open]);

  // 关闭时重置
  const handleClose = () => {
    if (loading || summarizing) return;
    setUrl("");
    setError("");
    setResult(null);
    setSummary("");
    setSummaryError("");
    onClose();
  };

  const handleFetch = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);
    setSummary("");
    setSummaryError("");

    try {
      const cookie = getCookieForUrl(url.trim());
      const resp = await fetch("/api/clip/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), cookie }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || "抓取失败");
        return;
      }

      if (!data.success) {
        setError(data.error || "抓取失败");
        return;
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 生成摘要
  const handleSummarize = async () => {
    if (!selectedProvider || !selectedModel || !result?.content) return;
    setSummarizing(true);
    setSummaryError("");
    try {
      const messages = summaryPrompt(result.content.slice(0, 8000));
      const text = await chatCompletion(selectedProvider, selectedModel, messages);
      setSummary(text);
    } catch (err: any) {
      setSummaryError(err.message || "生成摘要失败");
    } finally {
      setSummarizing(false);
    }
  };

  const handleSave = () => {
    if (result) {
      onSave({ ...result, summary: summary || undefined });
      handleClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-label="链接收藏"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            链接收藏
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="关闭"
            disabled={loading || summarizing}
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* URL Input */}
          <form onSubmit={handleFetch} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              输入文章链接
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-brand-400"
                disabled={loading}
                autoFocus
              />
              <Button
                type="submit"
                disabled={loading || !url.trim()}
                size="sm"
                className="shrink-0"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    抓取中
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ExternalLink size={16} />
                    抓取
                  </span>
                )}
              </Button>
            </div>

            {/* Cookie 状态提示 */}
            {url.trim() && (() => {
              const domain = extractDomain(url.trim());
              const matchedCookie = getCookieForUrl(url.trim());
              if (!domain) return null;
              return (
                <p className="flex items-center gap-1.5 text-xs">
                  {matchedCookie ? (
                    <>
                      <CheckCircle size={12} className="text-green-500" />
                      <span className="text-green-600 dark:text-green-400">
                        ✅ 已配置 Cookie（匹配 {domain}）
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle size={12} className="text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400">
                        {domain.includes("zhihu") || domain.includes("weixin") || domain.includes("toutiao")
                          ? `⚠️ ${domain} 可能需要配置 Cookie（设置 → 抓取配置）`
                          : `ℹ️ ${domain} 无需 Cookie`}
                      </span>
                    </>
                  )}
                </p>
              );
            })()}
          </form>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Fetched result */}
          {result && (
            <div className="mt-6 space-y-4">
              {/* Title preview */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  标题
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {result.title}
                </p>
              </div>

              {/* Content preview */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  内容预览
                </p>
                <div className="mt-1 max-h-32 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {result.content.slice(0, 600)}
                  {result.content.length > 600 && "..."}
                </div>
              </div>

              {/* Divider */}
              <hr className="border-gray-100 dark:border-gray-800" />

              {/* AI Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Ai size={16} className="text-brand-500" />
                    AI 摘要
                  </p>

                  {/* Provider / Model selector */}
                  {providers.length > 0 && !summary && (
                    <div className="relative" ref={providerRef}>
                      <button
                        type="button"
                        onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                        className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      >
                        <span>
                          {selectedProvider?.name || "选择服务商"}
                          {selectedModel ? ` · ${selectedModel}` : ""}
                        </span>
                        <ChevronDown size={14} />
                      </button>

                      {showProviderDropdown && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                          {providers.map((p) => (
                            <div key={p.id}>
                              <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500">
                                {p.name}
                              </div>
                              {p.models.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => {
                                    setSelectedProvider(p);
                                    setSelectedModel(m);
                                    setShowProviderDropdown(false);
                                  }}
                                  className={`w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                                    selectedProvider?.id === p.id &&
                                    selectedModel === m
                                      ? "text-brand-600 dark:text-brand-400"
                                      : "text-gray-700 dark:text-gray-300"
                                  }`}
                                >
                                  {selectedProvider?.id === p.id &&
                                  selectedModel === m ? "✓ " : ""}
                                  {m}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {providers.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    请先在「模型配置」页面添加服务商和模型
                  </p>
                )}

                {/* Summarize button or result */}
                {!summary && providers.length > 0 && (
                  <Button
                    onClick={handleSummarize}
                    disabled={summarizing || !selectedModel}
                    size="sm"
                    variant="ghost"
                    className="w-full"
                  >
                    {summarizing ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        正在生成摘要...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Ai size={16} />
                        生成摘要
                      </span>
                    )}
                  </Button>
                )}

                {summaryError && (
                  <p className="text-xs text-red-500">{summaryError}</p>
                )}

                {summary && (
                  <div>
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed text-gray-700 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:focus:border-brand-400"
                      rows={4}
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      可编辑摘要内容
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Save / Cancel */}
        {result && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {/* 摘要状态 */}
              {summary && (
                <span className="flex items-center gap-1 text-green-500">
                  <CheckCircle size={12} /> 已生成摘要
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleClose}
                size="sm"
                variant="ghost"
                disabled={loading || summarizing}
              >
                取消
              </Button>
              <Button onClick={handleSave} size="sm" disabled={summarizing}>
                <NoteIcon size={16} className="mr-1" />
                保存
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
