"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@ai-notes/ui-kit";
import { Import as ImportIcon, Close } from "@ai-notes/icons";
import { importFile, detectImportFormat } from "@/lib/convert";
import { createNote, updateNote } from "@/lib/storage";
import { useRouter } from "next/navigation";

interface ImportItem {
  title: string;
  html: string;
  tags?: string[];
}

export function ImportDialog() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const handleFiles = useCallback(async (files: FileList) => {
    const results: ImportItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fmt = detectImportFormat(file.name);
      if (!fmt) continue;
      try {
        const imported = await importFile(file);
        results.push(...imported);
      } catch {
        // 跳过失败文件
      }
    }
    setItems(results);
    setDone(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = "";
      }
    },
    [handleFiles]
  );

  const handleImport = async () => {
    setImporting(true);
    for (const item of items) {
      const note = createNote(item.title);
      updateNote(note.id, {
        html: item.html,
        json: {},
        tags: item.tags,
      });
    }
    setImporting(false);
    setDone(true);
    setItems([]);
    window.dispatchEvent(new CustomEvent("ai-notes:note-changed"));
    router.refresh();
  };

  const handleClose = () => {
    setOpen(false);
    setItems([]);
    setDone(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ImportIcon size={16} className="mr-1" />
        导入
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-gray-900">
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            导入笔记
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <Close size={20} />
          </button>
        </div>

        <div className="p-5">
          {done ? (
            /* 完成状态 */
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <ImportIcon size={28} />
              </div>
              <p className="text-gray-700 dark:text-gray-300">导入完成！笔记已添加到列表。</p>
              <Button onClick={handleClose}>关闭</Button>
            </div>
          ) : items.length === 0 ? (
            /* 拖拽/选择区域 */
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
                dragging
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                  : "border-gray-300 hover:border-brand-400 dark:border-gray-600 dark:hover:border-brand-500"
              }`}
              onClick={() => inputRef.current?.click()}
            >
              <ImportIcon
                size={40}
                className="mb-3 text-gray-300 dark:text-gray-600"
              />
              <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                拖拽文件到此处，或点击选择
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                支持 .md .txt .html .docx .json
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".md,.mdx,.markdown,.txt,.html,.htm,.docx,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            /* 导入预览 */
            <div>
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                发现 {items.length} 篇笔记，确认导入：
              </p>
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      {(item.html.length || 0) > 0
                        ? item.html.length + " 字符"
                        : "空内容"}
                    </p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setItems([]); setDone(false); }}>
                  重新选择
                </Button>
                <Button size="sm" loading={importing} onClick={handleImport}>
                  导入 {items.length > 1 ? `(${items.length} 篇)` : ""}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
