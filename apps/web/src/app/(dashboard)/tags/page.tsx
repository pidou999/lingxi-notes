"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tag as TagIcon, Folder, Pin } from "@ai-notes/icons";
import { getAllTags, getNotesByTag } from "@/lib/storage";
import { isLoggedIn, apiListTags, apiListNotesByTag, type NoteData } from "@/lib/api";
import type { Note } from "@/lib/types";
import type { TagWithCount } from "@/lib/storage";

export default function TagsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag") || "";

  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  const refresh = useCallback(() => {
    const localTags = getAllTags();

    if (activeTag) {
      // 笔记过滤视图
      const localNotes = getNotesByTag(activeTag);
      if (!isLoggedIn()) {
        setNotes(localNotes);
        setTags(localTags);
        return;
      }
      // 登录态：加载后端标签笔记
      apiListNotesByTag(activeTag).then((apiResults) => {
        const apiNotes: Note[] = apiResults.map((d: NoteData) => ({
          id: d.id,
          title: d.title,
          html: d.html,
          json: (() => { try { return JSON.parse(d.json); } catch { return {}; } })(),
          tags: d.tags ? d.tags.split(",").filter(Boolean) : [],
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }));
        // 合并去重
        const seen = new Set(localNotes.map((n) => n.id));
        const merged = [...localNotes];
        for (const n of apiNotes) {
          if (!seen.has(n.id)) { merged.push(n); seen.add(n.id); }
        }
        setNotes(merged);
      }).catch(() => setNotes(localNotes));
      setTags(localTags);
    } else {
      // 标签云视图
      if (!isLoggedIn()) {
        setTags(localTags);
        return;
      }
      // 登录态：加载后端标签列表
      apiListTags().then((apiResults) => {
        // 合并本地 + 后端标签
        const seen = new Set(localTags.map((t) => t.name));
        const merged = [...localTags];
        for (const t of apiResults) {
          if (!seen.has(t.name)) {
            merged.push({ name: t.name, count: t.count });
            seen.add(t.name);
          }
        }
        setTags(merged);
      }).catch(() => setTags(localTags));
    }
  }, [activeTag]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Tag cloud view ──
  if (!activeTag) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-2">
          <TagIcon size={24} className="text-gray-500 dark:text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            标签
          </h1>
          {tags.length > 0 && (
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {tags.reduce((s, t) => s + t.count, 0)} 个标记 · {tags.length} 个标签
            </span>
          )}
        </div>

        {tags.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-16 dark:border-gray-700">
            <div className="text-center">
              <TagIcon size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">
                还没有标签，在编辑笔记时可以通过 AI 推荐或手动添加标签
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => router.push(`/tags?tag=${encodeURIComponent(tag.name)}`)}
                className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm transition-all hover:border-brand-300 hover:bg-brand-50 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-700 dark:hover:bg-brand-900/20"
              >
                <TagIcon size={14} className="text-gray-400 group-hover:text-brand-500 dark:group-hover:text-brand-400" />
                <span className="text-gray-700 dark:text-gray-300">{tag.name}</span>
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {tag.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Filtered by tag ──
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/tags")}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <TagIcon size={22} className="text-gray-500 dark:text-gray-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {activeTag}
        </h1>
        <span className="text-sm text-gray-400 dark:text-gray-500">
          {notes.length} 篇笔记
        </span>
      </div>

      {notes.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-16 dark:border-gray-700">
          <div className="text-center">
            <TagIcon size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              该标签下没有笔记
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
              <h3 className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                {note.title || "未命名笔记"}
              </h3>

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
                  {note.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        t === activeTag
                          ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                          : "bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                      }`}
                    >
                      {t}
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
