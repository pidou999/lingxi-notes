"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Ai, Close, Loader2, Note } from "@ai-notes/icons";
import { chatCompletion, getProviders } from "@/lib/providers";
import { htmlToText } from "@/lib/search";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  /** 当前笔记内容，作为 AI 上下文 */
  noteTitle?: string;
  noteHtml?: string;
}

export function ChatPanel({ open, onClose, noteTitle, noteHtml }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开时聚焦输入
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 关闭时重置
  const handleClose = useCallback(() => {
    if (loading) return;
    setMessages([]);
    setInput("");
    onClose();
  }, [loading, onClose]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const providers = getProviders().filter((p) => p.models.length > 0);
    if (providers.length === 0) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "请先在「模型配置」页面添加服务商和模型。" },
      ]);
      return;
    }

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // 构建系统提示：基于笔记内容
      const noteContext = htmlToText(noteHtml || "").slice(0, 3000);
      const systemPrompt = noteContext
        ? `你是一个基于用户笔记的 AI 助手。下面是用户当前笔记的内容，请根据笔记内容回答用户的问题。` +
          `如果问题与笔记无关，可以结合你的知识回答。\n\n当前笔记标题：${noteTitle || "无标题"}\n\n笔记内容：\n${noteContext}`
        : "你是一个 AI 助手，请回答用户的问题。";

      const systemMsg = { role: "system", content: systemPrompt };
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const allMessages = [systemMsg, ...history, { role: "user", content: text }];

      const provider = providers[0];
      const model = provider.models[0];
      const result = await chatCompletion(provider, model, allMessages);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result || "（没有获得回答）" },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "错误: " + (err.message || "调用失败") },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      handleClose();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 md:bg-transparent md:pointer-events-none"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed bottom-0 right-0 top-14 z-50 flex w-full flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 md:top-0 md:w-96">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Ai size={18} className="text-brand-500" />
            <span className="font-medium text-gray-900 dark:text-gray-100">
              AI 对话
            </span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="关闭"
          >
            <Close size={18} />
          </button>
        </div>

        {/* Context indicator */}
        {noteTitle && (
          <div className="flex items-center gap-1.5 border-b border-gray-50 bg-gray-50/50 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
            <Note size={12} />
            基于：<span className="truncate font-medium">{noteTitle}</span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-gray-400 dark:text-gray-500">
              <Ai size={32} className="mb-2 text-gray-300 dark:text-gray-600" />
              <p>基于当前笔记内容，向 AI 提问</p>
              <p className="mt-1 text-xs">可以问总结、理解、扩展等问题</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-brand-600 text-white dark:bg-brand-500"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                思考中...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:focus-within:border-brand-400">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="向 AI 提问..."
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none dark:text-gray-100 dark:placeholder-gray-500"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-brand-600 disabled:opacity-40 dark:hover:bg-gray-700 dark:hover:text-brand-400"
              aria-label="发送"
            >
              <Ai size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
