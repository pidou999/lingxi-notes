"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Link as LinkIcon, ChevronDown, ChevronRight } from "@ai-notes/icons";
import { getBacklinks, type Backlink } from "@/lib/wikilinks";

interface BacklinksPanelProps {
  /** 当前笔记 ID */
  noteId: string;
  /** 面板是否展开 */
  defaultOpen?: boolean;
}

export function BacklinksPanel({ noteId, defaultOpen = true }: BacklinksPanelProps) {
  const router = useRouter();
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [open, setOpen] = useState(defaultOpen);

  const refresh = useCallback(() => {
    setBacklinks(getBacklinks(noteId));
  }, [noteId]);

  useEffect(() => {
    refresh();

    // 监听笔记变化事件
    const handler = () => refresh();
    window.addEventListener("ai-notes:note-changed", handler);
    return () => window.removeEventListener("ai-notes:note-changed", handler);
  }, [refresh]);

  if (backlinks.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* 标题栏 */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 rounded-t-xl"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <LinkIcon size={14} className="text-brand-500" />
        <span>反向链接</span>
        <span className="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
          {backlinks.length}
        </span>
      </button>

      {/* 列表 */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {backlinks.map((bl) => (
            <div
              key={bl.noteId}
              onClick={() => router.push(`/edit?id=${bl.noteId}`)}
              className="group flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-gray-300 group-hover:text-brand-500 dark:text-gray-600 dark:group-hover:text-brand-400"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 group-hover:text-brand-600 dark:text-gray-100 dark:group-hover:text-brand-400">
                  {bl.noteTitle}
                </p>
                {bl.context && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-400 dark:text-gray-500">
                    {bl.context}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
