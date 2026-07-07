"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, ExternalLink, MoreHorizontal, Trash2 } from "@ai-notes/icons";
import { Button } from "@ai-notes/ui-kit";
import { getNotes, deleteNote } from "@/lib/storage";
import type { Note } from "@/lib/types";

export default function BookmarksPage() {
  const router = useRouter();
  const [clips, setClips] = useState<Note[]>([]);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // 找出包含 "**原文**" 的笔记作为收藏
  useEffect(() => {
    const all = getNotes();
    const extracted = all.filter(
      (n) => n.html?.includes("原文") || n.html?.includes("来源")
    );
    setClips(extracted);
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定删除这条收藏吗？")) return;
    deleteNote(id);
    setMenuOpen(null);
    setClips((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          收藏
        </h1>
        <Button
          onClick={() => router.push("/notes")}
          size="sm"
          variant="ghost"
          className="shrink-0 whitespace-nowrap"
        >
          <ExternalLink size={16} className="mr-1" />
          去笔记页收藏链接
        </Button>
      </div>

      {clips.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-16 dark:border-gray-700">
          <div className="text-center">
            <Bookmark
              size={48}
              className="mx-auto text-gray-300 dark:text-gray-600"
            />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              暂无收藏 — 在笔记页点击「链接收藏」抓取文章
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clips.map((clip) => {
            // 从 html 中提取标题
            const titleMatch = clip.html?.match(
              /<a href="([^"]+)">([^<]+)<\/a>/
            );
            const linkUrl = titleMatch?.[1] || "";
            const linkTitle = titleMatch?.[2] || clip.title || "未命名";

            return (
              <div
                key={clip.id}
                onClick={() => router.push(`/notes/${clip.id}`)}
                className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-brand-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {linkTitle}
                    </h3>
                    {linkUrl && (
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400"
                      >
                        <ExternalLink size={12} />
                        <span className="truncate">{linkUrl}</span>
                      </a>
                    )}
                  </div>
                  <div className="relative shrink-0 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === clip.id ? null : clip.id);
                      }}
                      className="rounded-lg p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 group-hover:opacity-100 dark:hover:bg-gray-800"
                      aria-label="更多操作"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {menuOpen === clip.id && (
                      <div className="absolute right-0 top-full z-10 mt-1 w-32 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                        <button
                          onClick={(e) => handleDelete(clip.id, e)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                  {clip.html
                    ?.replace(/<[^>]*>/g, "")
                    .replace(linkTitle, "")
                    .slice(0, 100)
                    .trim() || "抓取的内容"}
                </p>
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                  {new Date(clip.updatedAt).toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
