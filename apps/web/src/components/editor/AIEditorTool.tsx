"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { type Editor } from "@tiptap/react";
import { Ai, ChevronDown, Loader2 } from "@ai-notes/icons";
import { cn } from "@ai-notes/ui-kit";
import { getProviders, chatCompletion } from "@/lib/providers";
import type { ProviderConfig } from "@/lib/providers";

type AIAction = {
  id: string;
  label: string;
  prompt: (text: string) => string;
  /** 替换选中文本还是插入到选中后 */
  mode: "replace" | "insert-after";
};

const ACTIONS: AIAction[] = [
  {
    id: "rewrite",
    label: "改写",
    prompt: (text) =>
      `请用不同的表达方式改写以下文字，保持原意，直接输出改写后的内容：\n\n${text}`,
    mode: "replace",
  },
  {
    id: "continue",
    label: "续写",
    prompt: (text) =>
      `请续写以下文字，保持风格一致，直接输出续写内容：\n\n${text}`,
    mode: "insert-after",
  },
  {
    id: "expand",
    label: "扩写",
    prompt: (text) =>
      `请将以下文字扩写得更详细，丰富细节，直接输出扩写后的完整内容：\n\n${text}`,
    mode: "replace",
  },
  {
    id: "shorten",
    label: "缩写",
    prompt: (text) =>
      `请将以下文字缩写，保留核心信息，直接输出缩写后的内容：\n\n${text}`,
    mode: "replace",
  },
  {
    id: "fix-grammar",
    label: "修正语法",
    prompt: (text) =>
      `请修正以下文字的语法和用词错误，保持原意，直接输出修正后的内容：\n\n${text}`,
    mode: "replace",
  },
];

interface AIEditorToolProps {
  editor: Editor;
}

export function AIEditorTool({ editor }: AIEditorToolProps) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleAction = useCallback(
    async (action: AIAction) => {
      setError("");
      const { empty, from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to);

      if (empty && action.id !== "continue") {
        setError("请先选中要处理的文字");
        return;
      }

      // 如果没有选中文字且是续写，从光标位置获取上下文
      const text =
        empty && action.id === "continue"
          ? editor.state.doc.textBetween(Math.max(0, from - 200), from)
          : selectedText;

      if (!text.trim()) {
        setError("没有可处理的文字");
        return;
      }

      // 获取第一个可用的 provider
      const providers = getProviders().filter((p) => p.models.length > 0);
      if (providers.length === 0) {
        setError("请先在「模型配置」页面添加服务商和模型");
        return;
      }

      // 使用第一个 provider 的第一个模型
      const provider = providers[0];
      const model = provider.models[0];

      setRunning(action.id);
      try {
        const result = await chatCompletion(provider, model, [
          { role: "system", content: "你是一个专业的文字编辑助手。直接输出结果，不要加任何多余说明。" },
          { role: "user", content: action.prompt(text) },
        ]);

        if (result) {
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              if (action.mode === "replace") {
                tr.replaceWith(from, to, editor.schema.text(result));
              } else {
                // insert-after: 在选中文本后面插入
                tr.insert(to, editor.schema.text("\n\n" + result));
              }
              return true;
            })
            .run();
        }

        setRunning(null);
        setOpen(false);
      } catch (err: any) {
        setError(err.message || "调用 AI 失败");
        setRunning(null);
      }
    },
    [editor]
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        className={cn(
          "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          open
            ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        )}
        title="AI 助手"
        aria-label="AI 助手"
      >
        <Ai size={16} />
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {running ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              处理中...
            </div>
          ) : (
            ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAction(action);
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {action.label}
              </button>
            ))
          )}

          {error && (
            <div className="border-t border-gray-100 px-4 py-2 text-xs text-red-500 dark:border-gray-700">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
