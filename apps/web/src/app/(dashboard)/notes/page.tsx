"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ai-notes/ui-kit";
import { Note as NoteIcon, MoreHorizontal, Trash2, Link as LinkIcon } from "@ai-notes/icons";
import { getNotes, createNote, deleteNote, updateNote } from "@/lib/storage";
import type { Note } from "@/lib/types";
import { ClipDialog } from "@/components/clip/ClipDialog";
import { SmartSearch } from "@/components/search/SmartSearch";
import { marked } from "marked";

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [clipOpen, setClipOpen] = useState(false);

  const refresh = useCallback(() => {
    setNotes(getNotes());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = () => {
    const note = createNote("");
    router.push(`/notes/${note.id}`);
  };

  const handleClipSave = (result: { title: string; content: string; url: string; summary?: string }) => {
    if (!result?.content) return;
    const note = createNote(result.title);

    // 用 marked 将 Markdown 转换为标准 HTML
    let bodyHtml = "";
    try {
      bodyHtml = marked.parse(result.content) as string;
    } catch {
      // 回退：纯文本转义
      bodyHtml = "<pre>" + result.content.replace(/</g, "&lt;") + "</pre>";
    }

    let fullHtml =
      '<p><a href="' +
      result.url +
      '">' +
      result.title +
      "</a></p>\n";

    // 如果有摘要，插入到开头
    if (result.summary) {
      const escapedSummary = result.summary
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      fullHtml +=
        '<blockquote style="border-left:3px solid #eab308;background:#fefce8;padding:12px 16px;margin:12px 0;border-radius:8px;color:#92400e">' +
        "<strong>📝 摘要</strong><br>" +
        escapedSummary.replace(/\n/g, "<br>") +
        "</blockquote>\n";
    }

    fullHtml += bodyHtml;

    updateNote(note.id, {
      html: fullHtml,
      json: {}, // 清空 json，让编辑器从 html 回退渲染
    });
    router.push(`/notes/${note.id}`);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNote(id);
    setMenuOpen(null);
    refresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          笔记
        </h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setClipOpen(true)}
            variant="ghost"
            size="sm"
            className="shrink-0 whitespace-nowrap"
          >
            <LinkIcon size={16} className="mr-1" />
            链接收藏
          </Button>
          <Button onClick={handleCreate} size="sm" className="shrink-0 whitespace-nowrap">
            新建笔记
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <SmartSearch />

      {notes.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-16 dark:border-gray-700">
          <div className="text-center">
            <NoteIcon
              size={48}
              className="mx-auto text-gray-300 dark:text-gray-600"
            />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              还没有笔记，点击上方按钮创建第一篇
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => router.push(`/notes/${note.id}`)}
              className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-brand-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-700"
            >
              <div className="flex items-start justify-between">
                <h3 className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {note.title || "未命名笔记"}
                </h3>
                <div className="relative shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === note.id ? null : note.id);
                    }}
                    className="rounded-lg p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 group-hover:opacity-100 dark:hover:bg-gray-800"
                    aria-label="更多操作"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {menuOpen === note.id && (
                    <div className="absolute right-0 top-full z-10 mt-1 w-32 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                      <button
                        onClick={(e) => handleDelete(note.id, e)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-2 line-clamp-3 text-xs text-gray-500 dark:text-gray-400">
                {note.html
                  ? note.html.replace(/<[^>]*>/g, "").slice(0, 120)
                  : "空笔记"}
              </p>
              <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                {new Date(note.updatedAt).toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
      <ClipDialog
        open={clipOpen}
        onClose={() => setClipOpen(false)}
        onSave={handleClipSave}
      />
    </div>
  );
}
