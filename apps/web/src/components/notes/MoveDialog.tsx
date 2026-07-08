"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@ai-notes/ui-kit";
import { Close, Folder, Plus } from "@ai-notes/icons";
import { updateNote, getFolders } from "@/lib/storage";

interface Props {
  open: boolean;
  onClose: () => void;
  noteId: string;
  currentFolder?: string;
  onSaved: () => void;
}

export function MoveDialog({ open, onClose, noteId, currentFolder, onSaved }: Props) {
  const [folders, setFolders] = useState<string[]>([]);
  const [selected, setSelected] = useState(currentFolder || "");
  const [newFolder, setNewFolder] = useState("");
  const [showNew, setShowNew] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setShowNew(false);
      setNewFolder("");
      return;
    }
    setFolders(getFolders());
    setSelected(currentFolder || "");
  }, [open, currentFolder]);

  useEffect(() => {
    if (showNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNew]);

  const handleMove = () => {
    const target = showNew && newFolder.trim() ? newFolder.trim() : selected;
    updateNote(noteId, { folder: target || undefined } as any);
    onSaved();
    onClose();
  };

  const handleRemoveFolder = () => {
    updateNote(noteId, { folder: undefined } as any);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">移动到文件夹</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Close size={20} />
          </button>
        </div>

        <div className="p-5">
          {folders.length > 0 && (
            <div className="mb-3 space-y-1">
              {folders.map((f) => (
                <button
                  key={f}
                  onClick={() => { setSelected(f); setShowNew(false); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selected === f && !showNew
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                      : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  <Folder size={16} />
                  {f}
                </button>
              ))}
            </div>
          )}

          {showNew ? (
            <input
              ref={inputRef}
              type="text"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="新建文件夹名称"
              className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              onKeyDown={(e) => e.key === "Enter" && handleMove()}
            />
          ) : (
            <button
              onClick={() => setShowNew(true)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
            >
              <Plus size={16} />
              新建文件夹
            </button>
          )}

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={handleRemoveFolder}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              移出文件夹
            </button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
              <Button size="sm" onClick={handleMove}>移动</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
