"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ai-notes/ui-kit";
import { Trash2, RefreshCw, XCircle } from "@ai-notes/icons";
import { getTrashNotes, restoreNote, permanentDeleteNote } from "@/lib/storage";
import { isLoggedIn, apiListTrash, apiRestoreNote, apiPermanentDelete, apiRestoreAllTrash, apiEmptyTrash } from "@/lib/api";
import type { NoteData, TrashNoteData } from "@/lib/api";
import type { Note } from "@/lib/types";

export default function TrashPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    const local = getTrashNotes();

    if (!isLoggedIn()) {
      setNotes(local);
      setLoading(false);
      return;
    }

    // 登录态：加载后端数据
    apiListTrash().then((apiResults) => {
      // 后端数据转 Note 格式
      const apiNotes: Note[] = apiResults.map((d: TrashNoteData) => ({
        id: d.id,
        title: d.title,
        html: d.html,
        json: (() => { try { return JSON.parse(d.json); } catch { return {}; } })(),
        tags: d.tags ? d.tags.split(",").filter(Boolean) : [],
        deletedAt: d.deletedAt,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));

      // 合并本地 + 后端，去重
      const seen = new Set(local.map((n) => n.id));
      const combined = [...local];
      for (const n of apiNotes) {
        if (!seen.has(n.id)) {
          combined.push(n);
          seen.add(n.id);
        }
      }
      setNotes(combined);
      setLoading(false);
    }).catch(() => {
      // 后端不可用，纯本地
      setNotes(local);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRestore = (id: string) => {
    restoreNote(id);
    if (isLoggedIn()) apiRestoreNote(id).catch(() => {});
    refresh();
  };

  const handlePermanentDelete = (id: string) => {
    if (!confirm("确定永久删除这篇笔记？此操作不可恢复。")) return;
    permanentDeleteNote(id);
    if (isLoggedIn()) apiPermanentDelete(id).catch(() => {});
    refresh();
  };

  const handleCleanAll = () => {
    const expired = notes.filter((n) => n.deletedAt && (Date.now() - new Date(n.deletedAt).getTime()) / 86400000 >= 30);
    if (expired.length === 0) { alert("没有超过30天的过期笔记。"); return; }
    if (!confirm("确定永久删除 " + expired.length + " 篇过期笔记？")) return;
    expired.forEach((n) => {
      permanentDeleteNote(n.id);
      if (isLoggedIn()) apiPermanentDelete(n.id).catch(() => {});
    });
    refresh();
  };

  const handleRestoreAll = () => {
    if (notes.length === 0) return;
    if (!confirm("确定恢复全部 " + notes.length + " 篇笔记？")) return;
    notes.forEach((n) => {
      restoreNote(n.id);
    });
    if (isLoggedIn()) apiRestoreAllTrash().catch(() => {});
    refresh();
  };

  const handleEmptyTrash = () => {
    if (notes.length === 0) return;
    if (!confirm("确定清空回收站？" + notes.length + " 篇笔记将被永久删除，此操作不可恢复。")) return;
    notes.forEach((n) => {
      permanentDeleteNote(n.id);
    });
    if (isLoggedIn()) apiEmptyTrash().catch(() => {});
    refresh();
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">回收站</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">已删除的笔记会在 30 天后自动永久删除</p>
        </div>
        <div className="flex items-center gap-2">
          {notes.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleRestoreAll}>
                <RefreshCw size={16} className="mr-1" />恢复全部
              </Button>
              <Button variant="outline" size="sm" onClick={handleEmptyTrash} className="!text-red-600 !border-red-300 hover:!bg-red-50 dark:!border-red-800 dark:hover:!bg-red-900/20">
                <XCircle size={16} className="mr-1" />清空回收站
              </Button>
            </>
          )}
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Trash2 size={48} className="mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-lg text-gray-500 dark:text-gray-400">回收站为空</p>
          <Button className="mt-4" variant="outline" onClick={() => router.push("/notes")}>返回笔记列表</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => {
            const days = note.deletedAt ? Math.floor((Date.now() - new Date(note.deletedAt).getTime()) / 86400000) : 0;
            return (
              <div key={note.id} className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{note.title || "未命名笔记"}</h3>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    删除于 {formatDate(note.deletedAt)}
                    {days >= 30 && <span className="ml-2 inline-flex items-center gap-0.5 text-red-500"><XCircle size={12} />即将过期</span>}
                  </p>
                  {note.tags && note.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {note.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleRestore(note.id)} className="text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20" aria-label="恢复笔记"><RefreshCw size={16} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handlePermanentDelete(note.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="永久删除"><Trash2 size={16} /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
