"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ai-notes/ui-kit";
import { Note as NoteIcon, Folder, Star, Pin } from "@ai-notes/icons";
import { getStarredNotes, toggleStarred } from "@/lib/storage";
import type { Note } from "@/lib/types";

export default function StarredPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);

  const refresh = useCallback(() => {
    setNotes(getStarredNotes());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUnstar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleStarred(id);
    refresh();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={24} className="text-gray-500 dark:text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            星标
          </h1>
          {notes.length > 0 && (
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {notes.length} 篇
            </span>
          )}
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-16 dark:border-gray-700">
          <div className="text-center">
            <Star size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              还没有加星的笔记，在笔记菜单中点击「加星」即可标记
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => router.push(`/edit?id=${note.id}`)}
              className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-brand-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-700"
            >
              <div className="flex items-start justify-between">
                <h3 className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {note.title || "未命名笔记"}
                </h3>
                <button
                  onClick={(e) => handleUnstar(note.id, e)}
                  className="shrink-0 rounded-lg p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  title="取消加星"
                >
                  <Star size={14} />
                </button>
              </div>

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
                <span className="flex items-center gap-1">
                  {note.pinned && <Pin size={12} className="text-gray-400" title="已置顶" />}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
