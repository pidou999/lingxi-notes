"use client";

import { useState, useRef, type FormEvent } from "react";
import { Button } from "@ai-notes/ui-kit";
import { Note as NoteIcon, ExternalLink, Loader2, CheckCircle, XCircle } from "@ai-notes/icons";
import { getCookieForUrl } from "@/lib/cookies";

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
  const inputRef = useRef<HTMLInputElement>(null);

  // 关闭时重置
  const handleClose = () => {
    if (loading) return;
    setUrl("");
    setError("");
    setResult(null);
    onClose();
  };

  const handleFetch = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

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

  const handleSave = () => {
    if (result) {
      onSave(result);
      handleClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="mx-4 w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
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
            disabled={loading}
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* URL Input */}
        <form onSubmit={handleFetch} className="space-y-3 px-6 py-4">
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
                      {domain.includes("zhihu") || domain.includes("weixin") || domain.includes("mp.weixin")
                        ? <>⚠️ 需要配置 {domain} 的 Cookie → 设置 / 抓取配置</>
                        : <>ℹ️ {domain} 无需 Cookie（仅需登录的站点需要配置）</>
                      }
                    </span>
                  </>
                )}
              </p>
            );
          })()}

          {/* 提示文字 */}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            支持微信公众号、知乎文章、以及大多数公开网页
          </p>
        </form>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
            <XCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Result Preview */}
        {loading && (
          <div className="mx-6 mb-4 flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-6 py-10 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="text-center">
              <Loader2 size={32} className="mx-auto animate-spin text-brand-600" />
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                正在抓取并下载文章内容...
              </p>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="mx-6 mb-4 overflow-hidden rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
            {/* 成功提示 */}
            <div className="flex items-center gap-2 border-b border-green-200 px-4 py-3 dark:border-green-800">
              <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                抓取成功
              </span>
            </div>

            {/* 标题 */}
            <div className="px-4 py-3">
              <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {result.title}
              </h3>

              {/* 内容预览 */}
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-white/80 p-3 dark:bg-gray-800/60">
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  {result.content
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 去掉链接
                    .replace(/!\[.*?\]\(.*?\)/g, "[图片]")
                    .replace(/#{1,6}\s/g, "")
                    .replace(/\*\*/g, "")
                    .replace(/\n{3,}/g, "\n\n")
                    .slice(0, 500)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!result || loading}
          >
            <span className="flex items-center gap-2">
              <NoteIcon size={16} />
              保存为笔记
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
