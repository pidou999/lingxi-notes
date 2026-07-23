"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@ai-notes/ui-kit";
import { Export as ExportIcon, CheckCircle, Close } from "@ai-notes/icons";
import {
  htmlToMarkdown,
  htmlToPlainText,
  embedHtmlImages,
  getExportFilename,
  downloadFile,
  type ExportFormat,
} from "@/lib/convert";

interface Props {
  title: string;
  html: string;
  tags?: string[];
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "md", label: "Markdown" },
  { value: "json", label: "JSON" },
  { value: "txt", label: "纯文本" },
  { value: "docx", label: "Word" },
];

export function ExportSingleNote({ title, html, tags }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("md");
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleExport = async () => {
    if (!html) {
      alert("笔记内容为空，无法导出");
      return;
    }

    setExporting(true);

    try {
      let blob: Blob;
      const noteTitle = title || "未命名笔记";

      switch (format) {
        case "md": {
          const md = `# ${noteTitle}\n\n${htmlToMarkdown(html)}` +
            (tags && tags.length > 0 ? `\n\n标签: ${tags.join(", ")}` : "");
          blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
          break;
        }
        case "txt": {
          const txt = `${noteTitle}\n${"=".repeat(noteTitle.length)}\n\n${htmlToPlainText(html)}`;
          blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
          break;
        }
        case "json": {
          const embeddedHtml = await embedHtmlImages(html);
          const json = JSON.stringify(
            {
              title: noteTitle,
              html: embeddedHtml,
              tags,
              exportedAt: new Date().toISOString(),
            },
            null,
            2
          );
          blob = new Blob([json], { type: "application/json;charset=utf-8" });
          break;
        }
        case "docx": {
          const tagsHtml =
            tags && tags.length > 0
              ? `<p><strong>标签:</strong> ${tags.join(", ")}</p>`
              : "";
          const resp = await fetch("/api/export/docx", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ html: `<h1>${noteTitle}</h1>${tagsHtml}${html}`, title: noteTitle }),
          });
          if (!resp.ok) throw new Error("导出失败");
          blob = await resp.blob();
          break;
        }
        default:
          return;
      }

      const filename = getExportFilename(noteTitle, format);
      await downloadFile(blob, filename);

      setExporting(false);
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setOpen(false);
      }, 2000);
    } catch {
      setExporting(false);
      alert("导出失败，请重试");
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
        aria-label="导出笔记"
      >
        <ExportIcon size={18} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle size={32} className="text-green-500" />
              <p className="text-sm text-gray-700 dark:text-gray-300">已导出</p>
            </div>
          ) : (
            <>
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                导出格式
              </h3>
              <div className="space-y-1">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      format === opt.value
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        format === opt.value
                          ? "border-brand-600 bg-brand-600 dark:border-brand-500 dark:bg-brand-500"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {format === opt.value && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <span className="font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button size="sm" loading={exporting} onClick={handleExport}>
                  导出
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
