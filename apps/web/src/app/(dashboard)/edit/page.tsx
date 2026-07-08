"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@ai-notes/ui-kit";
import { ArrowLeft, Trash2, Ai } from "@ai-notes/icons";
import { TipTapEditor, type TipTapEditorHandle } from "@/components/editor/TipTapEditor";
import { TagInput } from "@/components/tags/TagInput";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ExportSingleNote } from "@/components/export/ExportSingleNote";
import { getNote, updateNote, deleteNote } from "@/lib/storage";
import type { Note } from "@/lib/types";

export default function NoteEditorPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [locked, setLocked] = useState(true);
  const [passwordInput, setPasswordInput] = useState("");
  const editorRef = useRef<TipTapEditorHandle>(null);

  const loadNote = useCallback(() => {
    if (!id) {
      setNotFound(true);
      return;
    }
    const found = getNote(id);
    if (!found) {
      setNotFound(true);
      return;
    }
    setNote(found);
    setTitle(found.title);
    setTags(found.tags || []);
  }, [id]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  const handleAutoSave = useCallback(
    (html: string, json: Record<string, unknown>) => {
      const updated = updateNote(id, { html, json });
      if (updated) setNote(updated);
    },
    [id]
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    const updated = updateNote(id, { title: newTitle });
    if (updated) setNote(updated);
  };

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags);
    updateNote(id, { tags: newTags });
  };

  const handleSaveChatContent = (content: string) => {
    // 直接插入编辑器末尾，auto-save 会自然持久化
    editorRef.current?.appendHtml(content);
  };

  const handleDelete = () => {
    if (!confirm("确定删除这篇笔记吗？")) return;
    deleteNote(id);
    router.replace("/notes");
  };

  const handleGoBack = () => {
    router.push("/notes");
  };

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-lg text-gray-500 dark:text-gray-400">缺少笔记 ID</p>
        <Button className="mt-4" onClick={handleGoBack}>
          返回笔记列表
        </Button>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-lg text-gray-500 dark:text-gray-400">笔记不存在</p>
        <Button className="mt-4" onClick={handleGoBack}>
          返回笔记列表
        </Button>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  // 密码锁定检查
  if (locked && note.password) {
    return (
      <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-4">
        <span className="text-4xl">🔒</span>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">此笔记已加密</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">请输入密码查看内容</p>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          placeholder="输入密码"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (passwordInput === note.password) {
                setLocked(false);
              } else {
                alert("密码错误");
                setPasswordInput("");
              }
            }
          }}
        />
        <Button onClick={() => {
          if (passwordInput === note.password) {
            setLocked(false);
          } else {
            alert("密码错误");
            setPasswordInput("");
          }
        }} className="w-full">解锁</Button>
        <Button variant="ghost" onClick={handleGoBack}>返回</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col">
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleGoBack} aria-label="返回">
          <ArrowLeft size={18} />
        </Button>

        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="笔记标题"
          className="flex-1 border-0 bg-transparent text-lg font-semibold text-gray-900 placeholder-gray-400 outline-none dark:text-gray-100 dark:placeholder-gray-500"
        />

        {/* 状态指示器 */}
        <div className="flex items-center gap-1 text-base">
          {note.pinned && <span title="已置顶">📌</span>}
          {note.starred && <span title="已加星">⭐</span>}
          {note.password && <span title="已加密">🔒</span>}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setChatOpen(true)}
          className="text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
          aria-label="AI 对话"
        >
          <Ai size={18} />
        </Button>

        <ExportSingleNote title={title} html={note.html} tags={tags} />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          aria-label="删除笔记"
        >
          <Trash2 size={18} />
        </Button>
      </div>

      {/* Tags */}
      <div className="mb-3 px-1">
        <TagInput
          tags={tags}
          onChange={handleTagsChange}
          noteTitle={title}
          noteHtml={note.html}
        />
      </div>

      {/* Editor - fill remaining space */}
      <TipTapEditor
        ref={editorRef}
        contentJson={
          note.json && Object.keys(note.json).length > 0
            ? (note.json as Record<string, unknown>)
            : undefined
        }
        content={note.html || ""}
        onAutoSave={handleAutoSave}
        placeholder="开始写作..."
        className="flex-1 flex flex-col"
        editorClassName="flex-1"
      />

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        noteTitle={title}
        noteHtml={note.html}
        onSaveToNote={handleSaveChatContent}
      />
    </div>
  );
}
