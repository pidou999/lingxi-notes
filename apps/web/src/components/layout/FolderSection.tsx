"use client";

import { useState, useEffect, useCallback } from "react";
import { Folder, Plus, MoreHorizontal, Trash2, Note, ChevronLeft } from "@ai-notes/icons";
import { getFolders, renameFolder, deleteFolder, createFolder, createNote, updateNote } from "@/lib/storage";

export interface FolderSectionProps {
  /** 导航回调，SidebarNav 用此来重置自己的状态 */
  onNavigate?: (href: string) => void;
}

/**
 * 文件夹区域 — 独立于 SidebarNav，管理文件夹的展开/折叠、重命名、删除、新建、子文件夹
 */
export function FolderSection({ onNavigate }: FolderSectionProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [folderOpen, setFolderOpen] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [folderMenu, setFolderMenu] = useState<string | null>(null);
  const [subfolderParent, setSubfolderParent] = useState<string | null>(null);

  const refreshFolders = useCallback(() => setFolders(getFolders()), []);

  useEffect(() => {
    refreshFolders();
  }, [refreshFolders]);

  useEffect(() => {
    const handler = () => refreshFolders();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refreshFolders]);

  // 导航 — 关闭输入框状态后回调
  const navigateTo = (href: string) => {
    setShowNewFolder(false);
    setNewFolderInput("");
    setSubfolderParent(null);
    setFolderMenu(null);
    onNavigate?.(href);
  };

  // ── 操作 ─────────────────────────────────────

  const handleCreateFolder = () => {
    const name = newFolderInput.trim();
    if (!name) return;
    const fullName = subfolderParent ? `${subfolderParent}/${name}` : name;
    createFolder(fullName);
    refreshFolders();
    setShowNewFolder(false);
    setNewFolderInput("");
    setSubfolderParent(null);
  };

  const handleRename = (oldName: string) => {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) { setRenaming(null); return; }
    const fullNewName = isSubfolder(oldName)
      ? oldName.split("/").slice(0, -1).concat(newName).join("/")
      : newName;
    renameFolder(oldName, fullNewName);
    if (!isSubfolder(oldName)) {
      getChildrenOf(oldName).forEach((child) => {
        const childNewName = child.replace(oldName, fullNewName);
        renameFolder(child, childNewName);
      });
    }
    refreshFolders();
    setRenaming(null);
  };

  const handleDeleteFolder = (name: string) => {
    if (!confirm(`确定删除文件夹「${name}」？笔记不会被删除，但会移出此文件夹。`)) return;
    deleteFolder(name);
    refreshFolders();
  };

  // ── 工具 ──────────────────────────────────────
  const isSubfolder = (name: string) => name.includes("/");
  const getBaseName = (name: string) => isSubfolder(name) ? name.split("/").pop()! : name;
  const getChildrenOf = (parent: string) =>
    folders.filter((f) => f.startsWith(parent + "/")).sort();

  const rootFolders = folders.filter((f) => !isSubfolder(f));

  // ── 渲染单个文件夹条目 ──────────────────────
  const RenderFolder = ({ name, displayName }: { name: string; displayName: string }) => (
    <div className="group relative flex items-center">
      {renaming === name ? (
        <div className="flex w-full items-center gap-1 px-3 py-1.5">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="flex-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename(name);
              if (e.key === "Escape") setRenaming(null);
            }}
            autoFocus
          />
          <button
            onClick={() => handleRename(name)}
            className="rounded px-1.5 py-0.5 text-xs text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
          >
            确定
          </button>
          <button
            onClick={() => setRenaming(null)}
            className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            取消
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => navigateTo(`/notes?folder=${encodeURIComponent(name)}`)}
            className="flex flex-1 items-center rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Folder size={14} className="mr-2 shrink-0 text-gray-400" />
            <span className="flex-1 text-left">{displayName}</span>
          </button>

          {/* 三点菜单 */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFolderMenu(folderMenu === name ? null : name);
              }}
              className="rounded-lg p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <MoreHorizontal size={14} />
            </button>
            {folderMenu === name && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFolderMenu(null)} />
                <div className="absolute right-0 z-20 mt-1 min-w-[120px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <button
                    onClick={() => { setRenaming(name); setRenameValue(displayName); setFolderMenu(null); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <Folder size={14} />
                    重命名
                  </button>
                  <button
                    onClick={() => {
                      setFolderMenu(null);
                      const note = createNote("");
                      updateNote(note.id, { folder: name } as any);
                      navigateTo(`/edit?id=${note.id}`);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <Note size={14} />
                    新建笔记
                  </button>
                  {!isSubfolder(name) && (
                    <button
                      onClick={() => {
                        setFolderMenu(null);
                        setSubfolderParent(name);
                        setShowNewFolder(true);
                        setNewFolderInput("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      新建子文件夹
                    </button>
                  )}
                  <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                  <button
                    onClick={() => { setFolderMenu(null); handleDeleteFolder(name); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="mx-3 mt-1">
      <button
        type="button"
        onClick={() => setFolderOpen(!folderOpen)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <Folder size={20} />
        <span className="flex-1 text-left">文件夹</span>
        {folders.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {folders.length}
          </span>
        )}
        <ChevronLeft
          size={14}
          className={`transition-transform ${folderOpen ? "-rotate-90" : "rotate-180"}`}
        />
      </button>

      {folderOpen && (
        <div className="ml-2 mt-1 space-y-0.5">
          {rootFolders.map((rootName) => (
            <div key={rootName}>
              <RenderFolder name={rootName} displayName={rootName} />
              {getChildrenOf(rootName).map((childName) => (
                <div key={childName} className="ml-5 border-l-2 border-gray-100 pl-3 dark:border-gray-700">
                  <RenderFolder name={childName} displayName={getBaseName(childName)} />
                </div>
              ))}
            </div>
          ))}

          {/* 新建文件夹输入框 */}
          {showNewFolder && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <input
                type="text"
                value={newFolderInput}
                onChange={(e) => setNewFolderInput(e.target.value)}
                placeholder={subfolderParent ? `${subfolderParent}/子文件夹名称` : "文件夹名称"}
                className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") { setShowNewFolder(false); setNewFolderInput(""); setSubfolderParent(null); }
                }}
                autoFocus
              />
              <button
                onClick={handleCreateFolder}
                className="rounded px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
              >
                确定
              </button>
              <button
                onClick={() => { setShowNewFolder(false); setNewFolderInput(""); setSubfolderParent(null); }}
                className="rounded px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                取消
              </button>
            </div>
          )}

          {/* 新建文件夹按钮（根层级） */}
          <button
            type="button"
            onClick={() => {
              setSubfolderParent(null);
              setShowNewFolder(true);
              setNewFolderInput("");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
          >
            <Plus size={14} />
            新建文件夹
          </button>
        </div>
      )}
    </div>
  );
}
