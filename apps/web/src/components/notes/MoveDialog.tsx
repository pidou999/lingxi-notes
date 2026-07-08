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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setShowNew(false);
      setNewFolder("");
      return;
    }
    const all = getFolders();
    setFolders(all);
    setSelected(currentFolder || "");
    // 自动展开当前文件夹的父级
    if (currentFolder) {
      const parts = currentFolder.split("/");
      if (parts.length > 1) {
        const parent = parts.slice(0, -1).join("/");
        setExpanded((prev) => ({ ...prev, [parent]: true }));
      }
    }
  }, [open, currentFolder]);

  useEffect(() => {
    if (showNew && inputRef.current) inputRef.current.focus();
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

  // 工具函数
  const isSubfolder = (name: string) => name.includes("/");
  const getBaseName = (name: string) => isSubfolder(name) ? name.split("/").pop()! : name;
  const rootFolders = folders.filter((f) => !isSubfolder(f));
  const getDirectChildren = (parent: string) =>
    folders.filter((f) => f.startsWith(parent + "/") && !f.slice(parent.length + 1).includes("/")).sort();

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
          <div className="mb-3 max-h-64 space-y-0.5 overflow-y-auto">
            {/* 根目录选项 */}
            <button
              onClick={() => { setSelected(""); setShowNew(false); }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                selected === "" && !showNew
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              <Folder size={16} />
              根目录
            </button>

            {rootFolders.map((f) => {
              const children = getDirectChildren(f);
              const isExpanded = expanded[f];
              return (
                <div key={f}>
                  <div className="flex items-center">
                    {children.length > 0 ? (
                      <button
                        onClick={() => setExpanded((prev) => ({ ...prev, [f]: !prev[f] }))}
                        className="flex h-9 w-7 shrink-0 items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg
                          width="12" height="12" viewBox="0 0 12 12"
                          className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        >
                          <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    ) : (
                      <div className="w-7 shrink-0" />
                    )}
                    <button
                      onClick={() => { setSelected(f); setShowNew(false); }}
                      className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        selected === f && !showNew
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                          : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                      }`}
                    >
                      <Folder size={16} />
                      {f}
                    </button>
                  </div>
                  {/* 子文件夹 */}
                  {isExpanded && children.length > 0 && (
                    <div className="ml-5 space-y-0.5 border-l-2 border-gray-100 pl-1 dark:border-gray-700">
                      {children.map((child) => (
                        <button
                          key={child}
                          onClick={() => { setSelected(child); setShowNew(false); }}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                            selected === child && !showNew
                              ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                              : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                          }`}
                        >
                          <Folder size={16} />
                          {getBaseName(child)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

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
