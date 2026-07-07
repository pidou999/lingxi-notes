"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ai-notes/ui-kit";
import { ArrowLeft, Trash2 } from "@ai-notes/icons";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import { TagInput } from "@/components/tags/TagInput";
import { getNote, updateNote, deleteNote } from "@/lib/storage";
import type { Note } from "@/lib/types";

export default function NoteEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [notFound, setNotFound] = useState(false);

  const loadNote = useCallback(() => {
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

  const handleDelete = () => {
    deleteNote(id);
    router.replace("/notes");
  };

  const handleGoBack = () => {
    router.push("/notes");
  };

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

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col">
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
    </div>
  );
}
