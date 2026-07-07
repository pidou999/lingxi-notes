"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@ai-notes/ui-kit";

interface LinkDialogProps {
  editor: Editor;
  open: boolean;
  onClose: () => void;
}

export function LinkDialog({ editor, open, onClose }: LinkDialogProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [hasExistingLink, setHasExistingLink] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      const attrs = editor.getAttributes("link");
      const url = attrs.href || "";
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, "");

      setLinkUrl(url);
      setLinkText(text);
      setHasExistingLink(!!attrs.href);
      setLinkUrl(url);

      // Focus url input after dialog renders
      setTimeout(() => urlRef.current?.focus(), 100);
    }
  }, [open, editor]);

  const handleClose = () => {
    setLinkUrl("");
    setLinkText("");
    onClose();
  };

  const handleRemove = () => {
    editor.chain().focus().unsetLink().run();
    handleClose();
  };

  const handleInsert = () => {
    const url = linkUrl.trim();
    if (!url) return;

    // Auto-prepend https:// if missing protocol
    const finalUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const text = linkText.trim() || finalUrl;

    const { from, to } = editor.state.selection;

    if (from !== to) {
      // Selected text → wrap in link
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .setLink({ href: finalUrl })
        .run();
    } else {
      // No selection → insert linked text
      editor
        .chain()
        .focus()
        .insertContent(
          `<a href="${finalUrl}" rel="noopener noreferrer" target="_blank">${text}</a>`
        )
        .run();
    }

    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInsert();
    }
    if (e.key === "Escape") {
      handleClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            🔗 插入链接
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              链接地址
            </label>
            <input
              ref={urlRef}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              链接文字{" "}
              <span className="text-gray-400">（留空则显示链接地址）</span>
            </label>
            <input
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="链接文字"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {hasExistingLink && (
            <div>
              <button
                onClick={handleRemove}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
              >
                🗑️ 移除链接
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            取消
          </button>
          <button
            onClick={handleInsert}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium text-white",
              linkUrl.trim()
                ? "bg-blue-500 hover:bg-blue-600"
                : "cursor-not-allowed bg-gray-300 dark:bg-gray-600"
            )}
            disabled={!linkUrl.trim()}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
