"use client";

import { useState, type KeyboardEvent } from "react";
import { Close, Loader2, Plus } from "@ai-notes/icons";
import { chatCompletion, getProviders } from "@/lib/providers";
import { tagPrompt, parseTagResult } from "@/lib/tags";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** 笔记标题和内容用于 AI 推荐 */
  noteTitle?: string;
  noteHtml?: string;
}

export function TagInput({ tags, onChange, noteTitle, noteHtml }: TagInputProps) {
  const [input, setInput] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
      setInput("");
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  // AI 推荐标签
  const handleSuggest = async () => {
    if (!noteTitle && !noteHtml) return;
    const providers = getProviders().filter((p) => p.models.length > 0);
    if (providers.length === 0) {
      alert("请先在「模型配置」页添加服务商和模型");
      return;
    }

    setSuggesting(true);
    setSuggestions([]);

    try {
      const note = { title: noteTitle || "", html: noteHtml || "" };
      const messages = tagPrompt(note as any);
      const provider = providers[0];
      const model = provider.models[0];
      const raw = await chatCompletion(provider, model, messages);
      const parsed = parseTagResult(raw);
      setSuggestions(parsed.filter((t) => !tags.includes(t)));
    } catch (err: any) {
      alert("标签推荐失败: " + (err.message || ""));
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* 已有标签 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-800"
            >
              <Close size={10} />
            </button>
          </span>
        ))}

        {/* 输入框 */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "添加标签，按 Enter 确认..." : "添加标签"}
          className="min-w-[80px] flex-1 border-0 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none dark:text-gray-300 dark:placeholder-gray-500"
        />
      </div>

      {/* AI 推荐按钮 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSuggest}
          disabled={suggesting || (!noteTitle && !noteHtml)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-brand-500 dark:hover:text-brand-400"
        >
          {suggesting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Plus size={12} />
          )}
          AI 推荐标签
        </button>
      </div>

      {/* 推荐结果 */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-brand-50/50 p-2 dark:bg-brand-900/10">
          <span className="text-xs text-gray-400 dark:text-gray-500">推荐：</span>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                addTag(tag);
                setSuggestions((prev) => prev.filter((t) => t !== tag));
              }}
              className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-brand-300 px-2 py-0.5 text-xs text-brand-600 transition-colors hover:bg-brand-100 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-900/30"
            >
              <Plus size={10} />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
