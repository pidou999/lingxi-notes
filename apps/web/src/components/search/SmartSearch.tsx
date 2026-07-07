"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Ai, ChevronRight, Close } from "@ai-notes/icons";
import { getNotes } from "@/lib/storage";
import { keywordSearch, htmlToText, buildSemanticSearchPrompt, parseSearchResult } from "@/lib/search";
import { chatCompletion, getProviders } from "@/lib/providers";
import type { Note } from "@/lib/types";

export function SmartSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ note: Note; reason: string }[]>([]);
  const [mode, setMode] = useState<"keyword" | "ai">("keyword");
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!showResults) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showResults]);

  // 关键词搜索（实时）
  useEffect(() => {
    if (!query.trim() || mode !== "keyword") return;
    const notes = getNotes();
    const matched = keywordSearch(notes, query);
    setResults(matched.map((n) => ({ note: n, reason: "" })));
    setShowResults(true);
  }, [query, mode]);

  // AI 语义搜索
  const handleAiSearch = async () => {
    if (!query.trim() || searching) return;
    const providers = getProviders().filter((p) => p.models.length > 0);
    if (providers.length === 0) {
      alert("请先在「模型配置」页添加服务商和模型");
      return;
    }

    setSearching(true);
    setMode("ai");
    setShowResults(true);

    try {
      const notes = getNotes();
      if (notes.length === 0) {
        setResults([]);
        return;
      }

      const messages = buildSemanticSearchPrompt(query, notes);
      const provider = providers[0];
      const model = provider.models[0];
      const raw = await chatCompletion(provider, model, messages);
      const parsed = parseSearchResult(raw, notes);
      setResults(parsed);
    } catch {
      // 降级为关键词搜索
      const notes = getNotes();
      const matched = keywordSearch(notes, query);
      setResults(matched.map((n) => ({ note: n, reason: "" })));
    } finally {
      setSearching(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (mode === "ai") {
      setMode("keyword");
    }
    if (!value.trim()) {
      setResults([]);
      setShowResults(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searching) return;
      if (mode === "keyword" && query.trim()) {
        handleAiSearch();
      }
    }
    if (e.key === "Escape") {
      setShowResults(false);
    }
  };

  const navigateToNote = (id: string) => {
    setShowResults(false);
    setQuery("");
    setResults([]);
    router.push(`/edit?id=${id}`);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Search input */}
      <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:focus-within:border-brand-400">
        <Search size={16} className="shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          placeholder="搜索笔记... (Enter AI 搜索)"
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none dark:text-gray-100 dark:placeholder-gray-500"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <Close size={14} />
          </button>
        )}
        <button
          onClick={handleAiSearch}
          disabled={searching || !query.trim()}
          className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
          title="AI 语义搜索"
        >
          {searching ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Ai size={12} />
          )}
          AI 搜索
        </button>
      </div>

      {/* Results dropdown */}
      {showResults && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {/* Mode indicator */}
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            {mode === "ai" ? (
              <span className="flex items-center gap-1">
                <Ai size={12} className="text-brand-500" />
                AI 语义搜索
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Search size={12} />
                关键词匹配
              </span>
            )}
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span>{results.length} 条结果</span>
            {mode === "keyword" && (
              <span className="text-gray-300 dark:text-gray-600">
                · 按 Enter 使用 AI 搜索
              </span>
            )}
          </div>

          {searching ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              正在 AI 搜索...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              未找到匹配结果
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {results.map(({ note, reason }, i) => (
                <button
                  key={note.id + "-" + i}
                  onClick={() => navigateToNote(note.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {note.title || "无标题"}
                    </p>
                    {reason && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {reason}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 line-clamp-1">
                      {htmlToText(note.html).slice(0, 120)}
                    </p>
                  </div>
                  <ChevronRight size={14} className="mt-1 shrink-0 text-gray-300 dark:text-gray-600" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
