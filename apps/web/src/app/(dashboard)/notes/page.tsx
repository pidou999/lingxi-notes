"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@ai-notes/ui-kit";
import {
  Note as NoteIcon,
  MoreHorizontal,
  Trash2,
  Link as LinkIcon,
  ExternalLink,
  Folder,
  XCircle,
  Pin,
  Star,
  Lock,
} from "@ai-notes/icons";
import { getNotes, createNote, deleteNote, updateNote, togglePinned, toggleStarred, getFolders } from "@/lib/storage";
import type { Note } from "@/lib/types";
import { ClipDialog } from "@/components/clip/ClipDialog";
import { SmartSearch } from "@/components/search/SmartSearch";
import { ImportDialog } from "@/components/import/ImportDialog";
import { ExportMenu } from "@/components/export/ExportMenu";
import { PasswordDialog } from "@/components/notes/PasswordDialog";
import { MoveDialog } from "@/components/notes/MoveDialog";
import { marked } from "marked";

export default function NotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderFilter = searchParams.get("folder") || "";
  const [notes, setNotes] = useState<Note[]>([]);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [clipOpen, setClipOpen] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<string | null>(null);
  const [moveDialog, setMoveDialog] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // 分页计算
  const totalPages = useMemo(() => Math.max(1, Math.ceil(notes.length / PAGE_SIZE)), [notes.length]);
  const visibleNotes = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return notes.slice(start, start + PAGE_SIZE);
  }, [notes, currentPage, PAGE_SIZE]);

  // 点击空白处关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(null);
    const timer = setTimeout(() => {
      document.addEventListener("click", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handler);
    };
  }, [menuOpen]);

  // Toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(() => {
    let all = getNotes();
    if (folderFilter) {
      all = all.filter((n) => n.folder === folderFilter);
    }
    setNotes(all);
  }, [folderFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 笔记列表变化时重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [notes.length]);

  const handleCreate = () => {
    const note = createNote("");
    router.push(`/edit?id=${note.id}`);
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
    router.push(`/edit?id=${note.id}`);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定删除这篇笔记吗？")) return;
    deleteNote(id);
    setMenuOpen(null);
    refresh();
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    togglePinned(id);
    setMenuOpen(null);
    refresh();
  };

  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleStarred(id);
    setMenuOpen(null);
    refresh();
  };

  const handleShare = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/edit?id=${note.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setToast("链接已复制到剪贴板");
    }).catch(() => {
      // 降级：显示链接
      prompt("复制笔记链接：", url);
    });
    setMenuOpen(null);
  };

  const showToast = (msg: string) => setToast(msg);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Toast 提示 */}
      {toast && (
        <div className="fixed right-4 top-4 z-50 animate-in slide-in-from-right-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {folderFilter ? (
            <span className="flex items-center gap-2">
              <Folder size={22} />
              {folderFilter}
            </span>
          ) : (
            "笔记"
          )}
        </h1>
        <div className="flex items-center gap-2">
          <ImportDialog />
          <ExportMenu />
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => {
                setMenuOpen(null);
                // 有密码则先验证
                if (note.password) {
                  const pwd = prompt("此笔记已加密，请输入密码：");
                  if (pwd !== note.password) {
                    if (pwd !== null) alert("密码错误");
                    return;
                  }
                }
                router.push(`/edit?id=${note.id}`);
              }}
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
                    <div className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                      {/* 置顶 */}
                      <button
                        onClick={(e) => handleTogglePin(note.id, e)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <Pin size={14} />
                        {note.pinned ? "取消置顶" : "置顶"}
                      </button>
                      {/* 加星 */}
                      <button
                        onClick={(e) => handleToggleStar(note.id, e)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <Star size={14} />
                        {note.starred ? "取消加星" : "加星"}
                      </button>
                      {/* 分享 */}
                      <button
                        onClick={(e) => handleShare(note, e)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <ExternalLink size={14} />
                        分享
                      </button>
                      {/* 移动 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setMoveDialog(note.id); setMenuOpen(null); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <Folder size={14} />
                        移动
                      </button>
                      {/* 密码 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setPasswordDialog(note.id); setMenuOpen(null); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <Lock size={14} />
                        {note.password ? "修改密码" : "加密"}
                      </button>
                      {/* 分隔线 */}
                      <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                      {/* 删除 */}
                      <button
                        onClick={(e) => handleDelete(note.id, e)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* 文件夹标签 */}
              {note.folder && (
                <div className="mt-1.5 flex items-center gap-1">
                  <Folder size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">{note.folder}</span>
                </div>
              )}
              <p className="mt-2 line-clamp-3 text-xs text-gray-500 dark:text-gray-400">
                {note.html
                  ? note.html.replace(/<[^>]*>/g, "").slice(0, 120)
                  : "空笔记"}
              </p>
              {note.tags && note.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {note.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>
                  {new Date(note.updatedAt).toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  {note.pinned && <Pin size={12} className="text-gray-400" title="已置顶" />}
                  {note.starred && <Star size={12} className="text-gray-400" title="已加星" />}
                  {note.password && <Lock size={12} className="text-gray-400" title="已加密" />}
                </span>
              </p>
            </div>
          ))}

          {/* 分页导航 */}
          {totalPages > 1 && (
            <div className="col-span-full flex flex-col items-center gap-2 py-4">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                共 {notes.length} 篇 · 第 {currentPage}/{totalPages} 页
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  上一页
                </button>
                {(() => {
                  const pages: (number | string)[] = [];
                  for (let i = 1; i <= totalPages; i++) {
                    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
                      if (pages.length > 0 && pages[pages.length - 1] !== i - 1) pages.push("…");
                      pages.push(i);
                    }
                  }
                  return pages.map((p, idx) =>
                    typeof p === "string" ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={`min-w-[32px] rounded-lg px-2 py-1.5 text-sm transition-colors ${
                          p === currentPage
                            ? "bg-brand-600 text-white dark:bg-brand-500"
                            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <ClipDialog
        open={clipOpen}
        onClose={() => setClipOpen(false)}
        onSave={handleClipSave}
      />

      {/* 密码对话框 */}
      {passwordDialog && (
        <PasswordDialog
          open={!!passwordDialog}
          onClose={() => setPasswordDialog(null)}
          noteId={passwordDialog}
          currentPassword={notes.find((n) => n.id === passwordDialog)?.password}
          onSaved={() => { refresh(); showToast("已更新"); }}
        />
      )}

      {/* 移动对话框 */}
      {moveDialog && (
        <MoveDialog
          open={!!moveDialog}
          onClose={() => setMoveDialog(null)}
          noteId={moveDialog}
          currentFolder={notes.find((n) => n.id === moveDialog)?.folder}
          onSaved={() => { refresh(); showToast("已移动"); }}
        />
      )}
    </div>
  );
}
