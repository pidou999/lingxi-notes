"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@ai-notes/ui-kit";
import { Export as ExportIcon, Close, CheckCircle } from "@ai-notes/icons";
import { getNotes } from "@/lib/storage";
import {
  htmlToMarkdown,
  htmlToPlainText,
  notesToJson,
  htmlToDocx,
  getExportFilename,
  type ExportFormat,
  type ExportPayload,
} from "@/lib/convert";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; desc: string }[] = [
  { value: "md", label: "Markdown", desc: "HTML → Markdown 转换" },
  { value: "json", label: "JSON 备份", desc: "完整笔记数据，可重新导入" },
  { value: "txt", label: "纯文本", desc: "仅保留文字内容" },
  { value: "docx", label: "Word 文档", desc: "生成 .docx 文件" },
];

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("md");
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const [noteCount, setNoteCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
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
    const allNotes = getNotes();
    setNoteCount(allNotes.length);
    if (allNotes.length === 0) {
      alert("没有可导出的笔记");
      return;
    }

    setExporting(true);

    const payloads: ExportPayload[] = allNotes.map((n) => ({
      title: n.title || "未命名笔记",
      html: n.html || "",
      tags: n.tags,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));

    try {
      let blob: Blob;
      let filename: string;

      switch (format) {
        case "md": {
          const md = payloads
            .map((p) => {
              const title = `# ${p.title}\n\n`;
              const body = htmlToMarkdown(p.html);
              const tags =
                p.tags && p.tags.length > 0
                  ? "\n\n标签: " + p.tags.join(", ")
                  : "";
              return title + body + tags;
            })
            .join("\n\n---\n\n");
          blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
          filename = getExportFilename(new Date().toISOString().slice(0, 10), "md");
          break;
        }
        case "txt": {
          const txt = payloads
            .map((p) => {
              const title = p.title + "\n" + "=".repeat(p.title.length) + "\n\n";
              const body = htmlToPlainText(p.html);
              return title + body;
            })
            .join("\n\n==========\n\n");
          blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
          filename = getExportFilename(new Date().toISOString().slice(0, 10), "txt");
          break;
        }
        case "json": {
          const json = notesToJson(payloads);
          blob = new Blob([json], { type: "application/json;charset=utf-8" });
          filename = getExportFilename(new Date().toISOString().slice(0, 10), "json");
          break;
        }
        case "docx": {
          // docx: 全部导出为一个文档
          const combinedHtml = payloads
            .map((p) => {
              const titleHtml = `<h1>${p.title}</h1>`;
              const tagsHtml =
                p.tags && p.tags.length > 0
                  ? `<p><strong>标签:</strong> ${p.tags.join(", ")}</p>`
                  : "";
              return titleHtml + tagsHtml + p.html + "<hr/>";
            })
            .join("\n");
          blob = await htmlToDocx(combinedHtml, "灵犀笔记导出");
          filename = getExportFilename(new Date().toISOString().slice(0, 10), "docx");
          break;
        }
        default:
          return;
      }

      // 下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

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
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <ExportIcon size={16} className="mr-1" />
        导出
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle size={36} className="text-green-500" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                已导出 {noteCount} 篇笔记
              </p>
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
                    <span>
                      <span className="font-medium">{opt.label}</span>
                      <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                        {opt.desc}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button size="sm" loading={exporting} onClick={handleExport}>
                  导出全部
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
