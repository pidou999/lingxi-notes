"use client";

import { useState, useEffect, useCallback } from "react";
import { Folder, Plus, MoreHorizontal, Trash2, Note, ChevronLeft } from "@ai-notes/icons";
import { getFolders, renameFolder, deleteFolder, createFolder, createNote, updateNote, moveFolder } from "@/lib/storage";

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
  const [movingFolder, setMovingFolder] = useState<string | null>(null);
  const [moveExpanded, setMoveExpanded] = useState<Record<string, boolean>>({});
  const [folderExpanded, setFolderExpanded] = useState<Record<string, boolean>>({});

  const refreshFolders = useCallback(() => setFolders(getFolders()), []);

  useEffect(() => {
    refreshFolders();
  }, [refreshFolders]);

  useEffect(() => {
    const handler = () => refreshFolders();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refreshFolders]);

  // 监听自定义事件：笔记保存后刷新文件夹列表
  useEffect(() => {
    const handler = () => refreshFolders();
    window.addEventListener("ai-notes:folder-changed", handler);
    return () => window.removeEventListener("ai-notes:folder-changed", handler);
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
    // 判断当前页面是否在被删文件夹内，自动跳转
    const params = new URLSearchParams(window.location.search);
    const currentFolder = params.get("folder") || "";
    if (currentFolder === name || currentFolder.startsWith(name + "/")) {
      // 当前在被删文件夹或其子文件夹内 → 跳到笔记首页
      navigateTo("/notes");
    }
  };

  const handleMoveFolder = (source: string, targetParent: string) => {
    moveFolder(source, targetParent);
    refreshFolders();
    setMovingFolder(null);
  };

  // ── 工具 ──────────────────────────────────────
  const isSubfolder = (name: string) => name.includes("/");
  const getBaseName = (name: string) => isSubfolder(name) ? name.split("/").pop()! : name;
  const getChildrenOf = (parent: string) =>
    folders.filter((f) => f.startsWith(parent + "/")).sort();
  const getDirectChildren = (parent: string) =>
    folders.filter((f) => {
      if (!f.startsWith(parent + "/")) return false;
      const rest = f.slice(parent.length + 1);
      return !rest.includes("/"); // 只取直接子文件夹
    }).sort();

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
                  <button
                    onClick={() => {
                      setFolderMenu(null);
                      setSubfolderParent(name);
                      setShowNewFolder(true);
                      setNewFolderInput("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <Plus size={14} />
                    新建文件夹
                  </button>
                  <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                  <button
                    onClick={() => { setFolderMenu(null); setMovingFolder(name); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <Folder size={14} />
                    移动到…
                  </button>
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
          {rootFolders.map((rootName) => {
            const children = getChildrenOf(rootName);
            const isExpanded = folderExpanded[rootName] !== false; // 默认展开
            return (
              <div key={rootName}>
                <div className="flex items-center">
                  {children.length > 0 ? (
                    <button
                      onClick={() => setFolderExpanded((prev) => ({ ...prev, [rootName]: !isExpanded }))}
                      className="flex h-8 w-6 shrink-0 items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg
                        width="10" height="10" viewBox="0 0 10 10"
                        className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      >
                        <path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : (
                    <div className="w-6 shrink-0" />
                  )}
                  <div className="flex-1">
                    <RenderFolder name={rootName} displayName={rootName} />
                  </div>
                </div>
                {isExpanded && children.map((childName) => (
                  <div key={childName} className="ml-5 border-l-2 border-gray-100 pl-3 dark:border-gray-700">
                    <RenderFolder name={childName} displayName={getBaseName(childName)} />
                  </div>
                ))}
              </div>
            );
          })}

          {/* 新建文件夹输入框 */}
          {showNewFolder && (
            <div className="flex items-center gap-1 px-3 py-1.5">
              <input
                type="text"
                value={newFolderInput}
                onChange={(e) => setNewFolderInput(e.target.value)}
                placeholder={subfolderParent ? `${subfolderParent}/子文件夹名称` : "文件夹名称"}
                className="w-28 flex-shrink-0 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") { setShowNewFolder(false); setNewFolderInput(""); setSubfolderParent(null); }
                }}
                autoFocus
              />
              <button
                onClick={handleCreateFolder}
                className="shrink-0 rounded px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
              >
                确定
              </button>
              <button
                onClick={() => { setShowNewFolder(false); setNewFolderInput(""); setSubfolderParent(null); }}
                className="shrink-0 rounded px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
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

      {/* 移动文件夹弹窗（树形展开） */}
      {movingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              移动「{getBaseName(movingFolder)}」到…
            </h3>
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {/* 根目录 */}
              <button
                onClick={() => handleMoveFolder(movingFolder, "")}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Folder size={14} className="text-gray-400" />
                根目录
              </button>
              {rootFolders
                .filter((f) => f !== movingFolder)
                .map((f) => {
                  const children = getDirectChildren(f).filter((c) => c !== movingFolder);
                  const isExpanded = moveExpanded[f];
                  return (
                    <div key={f}>
                      <div className="flex items-center">
                        {children.length > 0 ? (
                          <button
                            onClick={() =>
                              setMoveExpanded((prev) => ({ ...prev, [f]: !prev[f] }))
                            }
                            className="flex h-8 w-6 shrink-0 items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 12 12"
                              fill="currentColor"
                              className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            >
                              <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        ) : (
                          <div className="w-6 shrink-0" />
                        )}
                        <button
                          onClick={() => handleMoveFolder(movingFolder, f)}
                          className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <Folder size={14} className="text-gray-400" />
                          {f}
                        </button>
                      </div>
                      {/* 子文件夹列表 */}
                      {isExpanded && children.length > 0 && (
                        <div className="ml-4 space-y-0.5 border-l-2 border-gray-100 pl-2 dark:border-gray-700">
                          {children.map((child) => (
                            <button
                              key={child}
                              onClick={() => handleMoveFolder(movingFolder, child)}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                              <Folder size={14} className="text-gray-400" />
                              {getBaseName(child)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setMovingFolder(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
