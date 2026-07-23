"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, Loader2, Ai, Close, ExternalLink } from "@ai-notes/icons";
import { getNotes } from "@/lib/storage";
import { keywordSearch, htmlToText } from "@/lib/search";
import { isLoggedIn, apiSearch } from "@/lib/api";
import type { NoteData } from "@/lib/api";
import {
  getEmbeddingProvider,
  getEmbeddingModelName,
  detectEmbeddingModel,
  getCachedEmbeddingModel,
  ensureAllEmbeddings,
  searchByVector,
  clearEmbeddings,
  warmUpApiRoute,
} from "@/lib/embeddings";
import { getProviders, chatCompletion } from "@/lib/providers";
import type { Note } from "@/lib/types";
import { ResultModal } from "../search/ResultModal";

interface SearchResultItem {
  note?: Note;
  reason?: string;
  webTitle?: string;
  webContent?: string;
  webDetail?: string;
  webUrl?: string;
  webSource?: string;
  type: "note" | "web";
}

export function TopBarSearch() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [mode, setMode] = useState<"keyword" | "ai">("keyword");
  const [searching, setSearching] = useState(false);
  const [webEnabled, setWebEnabled] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalNote, setModalNote] = useState<{ title: string; html: string; tags?: string[] } | undefined>();
  const [modalWebSingle, setModalWebSingle] = useState<{ title: string; content: string; url?: string } | undefined>();
  const [modalWebResults, setModalWebResults] = useState<
    { title: string; summary: string; detail: string; url: string; source: string }[]
  >([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded) setTimeout(() => inputRef.current?.focus(), 50);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [expanded]);

  const openResultModal = useCallback((item: SearchResultItem) => {
    if (item.type === "note" && item.note) {
      setModalNote({ title: item.note.title, html: item.note.html, tags: item.note.tags });
      setModalWebSingle(undefined);
      setModalWebResults([]);
      setModalOpen(true);
    } else if (item.type === "web") {
      const allWebResults = results
        .filter((r) => r.type === "web")
        .map((r) => ({
          title: r.webTitle || "",
          summary: r.webContent || "",
          detail: r.webDetail || "",
          url: r.webUrl || "",
          source: r.webSource || "",
        }));
      setModalNote(undefined);
      setModalWebSingle(undefined);
      setModalWebResults(allWebResults);
      setModalOpen(true);
    }
  }, [results]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalNote(undefined);
    setModalWebSingle(undefined);
    setModalWebResults([]);
  }, []);

  useEffect(() => {
    if (!query.trim() || !expanded || mode === "ai") {
      if (!query.trim()) setResults([]);
      return;
    }

    const localNotes = getNotes();
    const localMatched = keywordSearch(localNotes, query);

    if (!isLoggedIn()) {
      setResults(localMatched.map((n) => ({ note: n, type: "note" as const })));
      return;
    }

    apiSearch(query).then((apiResults) => {
      const seen = new Set(localMatched.map((n) => n.id));
      const apiNotes: Note[] = apiResults.map((d: NoteData) => ({
        id: d.id,
        title: d.title,
        html: d.html,
        json: (() => { try { return JSON.parse(d.json); } catch { return {}; } })(),
        tags: d.tags ? d.tags.split(",").filter(Boolean) : [],
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));
      const combined = [...localMatched];
      for (const n of apiNotes) {
        if (!seen.has(n.id)) {
          combined.push(n);
          seen.add(n.id);
        }
      }
      setResults(combined.map((n) => ({ note: n, type: "note" as const })));
    }).catch(() => {
      setResults(localMatched.map((n) => ({ note: n, type: "note" as const })));
    });
  }, [query, expanded, mode]);

  const handleAiSearch = useCallback(async () => {
    if (!query.trim() || searching) return;

    const provider = getEmbeddingProvider();

    if (!provider && !webEnabled) {
      alert("请先在设置页配置 API 服务商（需要 OpenAI 兼容协议），或勾选「联网」使用搜索引擎");
      return;
    }

    setSearching(true);
    setMode("ai");

    const apiReady = await warmUpApiRoute();
    if (!apiReady) {
      setResults([{
        type: "web",
        webTitle: "⚠️ API 路由不可用",
        webContent: "Embedding API 路由返回 404，请重启开发服务器后重试。",
        reason: "API 路由未就绪",
      }]);
      setSearching(false);
      return;
    }

    const notes = getNotes();
    let noteResults: SearchResultItem[] = [];
    if (provider) {
      try {
        let embedModel = getEmbeddingModelName(provider);

        if (notes.length > 0) {
          if (embedModel) {
            try {
              const cachedModel = getCachedEmbeddingModel();
              if (cachedModel !== embedModel) await clearEmbeddings();
              await ensureAllEmbeddings(notes, provider, embedModel);
              const matches = await searchByVector(query, provider, embedModel, 10);
              noteResults = matches
                .map((m) => ({
                  note: notes.find((n) => n.id === m.noteId),
                  reason: `相似度 ${(m.score * 100).toFixed(0)}%`,
                  type: "note" as const,
                }))
                .filter((r) => r.note) as SearchResultItem[];
            } catch (embedErr) {
              console.error("[AI搜索] Embedding 失败，尝试自动探测:", embedErr);
              embedModel = "";
            }
          }

          if (!embedModel) {
            console.log("[AI搜索] 无有效 embedding 模型，开始自动探测...");
            const detected = await detectEmbeddingModel(provider);
            if (detected) {
              embedModel = detected;
              console.log("[AI搜索] 探测到 embedding 模型:", embedModel);
              const allProviders = getProviders();
              const idx = allProviders.findIndex((p) => p.id === provider.id);
              if (idx >= 0) {
                allProviders[idx].embeddingModel = detected;
                const { saveProviders } = await import("@/lib/providers");
                saveProviders(allProviders);
                window.dispatchEvent(new Event("providers-changed"));
              }
              try {
                await clearEmbeddings();
                await ensureAllEmbeddings(notes, provider, embedModel);
                const matches = await searchByVector(query, provider, embedModel, 10);
                noteResults = matches
                  .map((m) => ({
                    note: notes.find((n) => n.id === m.noteId),
                    reason: `相似度 ${(m.score * 100).toFixed(0)}%`,
                    type: "note" as const,
                  }))
                  .filter((r) => r.note) as SearchResultItem[];
              } catch (detectErr) {
                console.error("[AI搜索] 探测到模型但搜索失败，降级为 AI 匹配:", detectErr);
                embedModel = "";
              }
            }

            if (!embedModel) {
              console.log("[AI搜索] 无可用 embedding 模型，降级为聊天模型语义匹配...");
              const allProviders = getProviders();
              const chatProvider = allProviders.find((p) => p.models.length > 0);
              if (chatProvider) {
                const chatModel = chatProvider.models[0];
                console.log("[AI搜索] 使用聊天模型:", chatProvider.name, chatModel);

                const summaries = notes.slice(0, 20).map((n) => ({
                  id: n.id,
                  title: n.title,
                  summary: htmlToText(n.html).slice(0, 200),
                }));
                const prompt = `请根据以下查询，从笔记列表中选出最相关的笔记 ID。
查询内容：${query}

笔记列表（ID: 标题 | 摘要）：
${summaries.map((s) => `${s.id}: ${s.title} | ${s.summary}`).join("\n")}

请直接返回相关笔记的 ID 列表，格式为：["id1", "id2", ...]。如果没有相关笔记，返回空数组 []。`;

                const answer = await chatCompletion(chatProvider, chatModel, [
                  { role: "system", content: "你是一个笔记匹配助手，只返回 JSON 格式的 ID 列表。" },
                  { role: "user", content: prompt },
                ]);

                let matchedIds: string[] = [];
                try {
                  const text = answer || "";
                  const arrayMatch = text.match(/\[[\s\S]*\]/);
                  if (arrayMatch) {
                    const inner = arrayMatch[0].slice(1, -1);
                    matchedIds = inner
                      .split(",")
                      .map((s) => s.trim().replace(/["']/g, ""))
                      .filter(Boolean);
                  }
                } catch { /* ignore */ }

                noteResults = matchedIds
                  .map((id) => notes.find((n) => n.id === id))
                  .filter((n): n is Note => !!n)
                  .map((n) => ({
                    note: n,
                    reason: "AI 语义匹配",
                    type: "note" as const,
                  }));
              }
            }
          }
        }
      } catch (e) {
        console.error("[AI搜索] 语义搜索异常，不影响联网搜索:", e);
      }
    }

    const webResults: SearchResultItem[] = [];
    if (webEnabled) {
      try {
        const resp = await fetch("/api/proxy/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: query }),
        });

        const data = await resp.json();

        if (!resp.ok || !data.results || data.results.length === 0) {
          webResults.push({
            webTitle: "⚠️ 联网搜索不可用",
            webContent: data.error || "搜索结果为空，可能是网络环境限制了搜索引擎访问",
            webDetail: data.details || data.error || "暂时无法获取搜索结果",
            webUrl: "",
            reason: "搜索失败",
            type: "web",
          });
        } else {
          console.log(`[联网搜索] 获取到 ${data.results.length} 条真实搜索结果`);
          data.results.forEach((r: { title: string; url: string; snippet: string; source: string }) => {
            webResults.push({
              webTitle: r.title,
              webContent: r.snippet,
              webDetail: r.snippet + "\n\n---\n来源：" + r.source + "\n地址：" + r.url,
              webUrl: r.url,
              webSource: r.source,
              type: "web" as const,
            });
          });
        }
      } catch (e) {
        console.error("[联网搜索] 错误:", e);
        webResults.push({
          webTitle: "⚠️ 联网搜索失败",
          webContent: "",
          webDetail: e instanceof Error
            ? `搜索请求失败: ${e.message}`
            : "未知错误，请检查网络连接",
          webUrl: "",
          reason: "请求失败",
          type: "web",
        });
      }
    }

    const allResults = [...noteResults, ...webResults];
    if (allResults.length > 0) {
      setResults(allResults);
    } else {
      const matched = keywordSearch(notes, query);
      setResults(matched.map((n) => ({ note: n, type: "note" as const })));
      setMode("keyword");
    }
    setSearching(false);
  }, [query, searching, webEnabled]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (mode === "ai") setMode("keyword");
    if (!value.trim()) setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searching) return;
      if (query.trim()) handleAiSearch();
    }
    if (e.key === "Escape") {
      setExpanded(false);
      setQuery("");
      setResults([]);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        aria-label="搜索笔记"
        title="搜索笔记"
      >
        <SearchIcon size={18} />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:focus-within:border-brand-400">
        <SearchIcon size={16} className="shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
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

        <label
          className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
            webEnabled
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          }`}
          title="联网搜索：同时搜索笔记和网络"
        >
          <input
            type="checkbox"
            checked={webEnabled}
            onChange={(e) => setWebEnabled(e.target.checked)}
            className="sr-only"
          />
          <ExternalLink size={12} />
          <span>联网</span>
        </label>

        <button
          onClick={handleAiSearch}
          disabled={searching || !query.trim()}
          className="flex items-center gap-1 rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
          title="AI 语义搜索"
        >
          {searching ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Ai size={12} />
          )}
          AI
        </button>
      </div>

      {query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            {mode === "ai" ? (
              <span className="flex items-center gap-1">
                <Ai size={12} className="text-brand-500" />
                AI 搜索
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <SearchIcon size={12} />
                关键词匹配
              </span>
            )}
            {webEnabled && (
              <>
                <span className="text-gray-300 dark:text-gray-600">+</span>
                <span className="flex items-center gap-1 text-blue-500">
                  <ExternalLink size={12} />
                  联网
                </span>
              </>
            )}
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span>{results.length} 条结果</span>
            {mode === "keyword" && query.trim() && (
              <span className="text-gray-300 dark:text-gray-600">
                · 按 Enter 使用 AI 搜索
              </span>
            )}
          </div>

          {searching ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              正在{webEnabled ? "联网" : ""} AI 搜索...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              未找到匹配结果
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {results.map((item, i) => (
                <button
                  key={item.type === "note" ? item.note!.id : "web-" + i}
                  onClick={() => openResultModal(item)}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="mt-0.5 shrink-0">
                    {item.type === "web" ? (
                      <ExternalLink size={14} className="text-blue-500" />
                    ) : (
                      <SearchIcon size={14} className="text-gray-400" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.type === "note"
                        ? item.note?.title || "无标题"
                        : item.webTitle || "网络搜索结果"}
                    </p>
                    {item.reason && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                        {item.reason}
                      </p>
                    )}
                    {item.type === "note" && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-gray-400 dark:text-gray-500">
                        {htmlToText(item.note?.html || "").slice(0, 120)}
                      </p>
                    )}
                    {item.type === "web" && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-gray-400 dark:text-gray-500">
                        {item.webContent?.replace(/<[^>]+>/g, "").slice(0, 120)}
                      </p>
                    )}
                  </div>

                  <span
                    className={`mt-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      item.type === "note"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    {item.type === "note" ? "笔记" : "网络"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ResultModal
        open={modalOpen}
        onClose={closeModal}
        note={modalNote}
        webResult={modalWebSingle}
        webResults={modalWebResults}
      />
    </div>
  );
}
