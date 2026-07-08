"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, type SidebarItem } from "@ai-notes/ui-kit";
import {
  Note,
  Bookmark,
  Ai,
  Tag,
  Folder,
  ChevronLeft,
  Trash2,
  Plus,
  Close,
} from "@ai-notes/icons";
import { LingxiLogo } from "./LingxiLogo";
import { getFolders, renameFolder, deleteFolder } from "@/lib/storage";

export interface SidebarNavProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onItemClick?: (item: SidebarItem) => void;
}

export function SidebarNav({
  collapsed,
  onToggleCollapse,
  onItemClick,
}: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [folders, setFolders] = useState<string[]>([]);
  const [folderOpen, setFolderOpen] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // 刷新文件夹列表
  const refreshFolders = useCallback(() => {
    setFolders(getFolders());
  }, []);

  useEffect(() => {
    refreshFolders();
  }, [refreshFolders]);

  // 监听 storage 变化（其他标签页修改时刷新）
  useEffect(() => {
    const handler = () => refreshFolders();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refreshFolders]);

  // 导航
  const navTo = (href: string) => {
    router.push(href);
    onItemClick?.(null as any);
  };

  // 新建文件夹
  const handleCreateFolder = () => {
    const name = newFolderInput.trim();
    if (!name) return;
    // 在 localStorage 中创建一个笔记来建立文件夹
    // 实际上文件夹存在于笔记的 folder 字段中，所以我们只需要新建一个笔记并设 folder
    // 或者直接创建一个空的文件夹标记
    import("@/lib/storage").then(({ createNote, updateNote }) => {
      const note = createNote("");
      updateNote(note.id, { folder: name } as any);
      refreshFolders();
      setNewFolderInput("");
    });
  };

  // 重命名
  const handleRename = (oldName: string) => {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) {
      setRenaming(null);
      return;
    }
    renameFolder(oldName, newName);
    refreshFolders();
    setRenaming(null);
  };

  // 删除文件夹
  const handleDeleteFolder = (name: string) => {
    if (!confirm(`确定删除文件夹「${name}」？笔记不会被删除，但会移出此文件夹。`)) return;
    deleteFolder(name);
    refreshFolders();
  };

  const mainItems: SidebarItem[] = [
    {
      id: "notes",
      label: "笔记",
      icon: <Note size={20} />,
      href: "/notes",
      active: pathname.startsWith("/notes") && !pathname.includes("starred"),
    },
    {
      id: "collections",
      label: "收藏",
      icon: <Bookmark size={20} />,
      href: "/bookmarks",
      active: pathname.startsWith("/bookmarks"),
    },
    {
      id: "ai",
      label: "AI 助手",
      icon: <Ai size={20} />,
      href: "/ai",
      active: pathname.startsWith("/ai"),
    },
    {
      id: "tags",
      label: "标签",
      icon: <Tag size={20} />,
      href: "/collections",
      active: pathname.startsWith("/collections"),
    },
    {
      id: "starred",
      label: "星标",
      icon: <span className="text-base">⭐</span>,
      href: "/starred",
      active: pathname.startsWith("/starred"),
    },
    {
      id: "trash",
      label: "回收站",
      icon: <Trash2 size={20} />,
      href: "/trash",
      active: pathname.startsWith("/trash"),
    },
  ];

  if (collapsed) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-4 pt-4 pb-2">
          <LingxiLogo collapsed={true} />
        </div>
        <Sidebar
          items={mainItems}
          collapsed={true}
          onItemClick={(item) => item.href && navTo(item.href)}
          className="flex-1"
        />
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center justify-center border-t border-gray-200 p-3 text-gray-400 hover:text-gray-600 dark:border-gray-700 dark:hover:text-gray-300"
          aria-label="展开侧边栏"
        >
          <ChevronLeft size={18} className="rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-2">
        <LingxiLogo collapsed={false} />
      </div>

      {/* 主导航 */}
      <Sidebar
        items={mainItems}
        collapsed={false}
        onItemClick={(item) => item.href && navTo(item.href)}
        className="flex-shrink-0"
      />

      {/* 文件夹区域 */}
      <div className="mt-2 border-t border-gray-100 px-3 pt-2 dark:border-gray-800">
        <button
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
            {folders.map((name) => (
              <div
                key={name}
                className="group flex items-center rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                {renaming === name ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(name);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="flex-1 rounded border border-brand-500 bg-white px-2 py-0.5 text-sm text-gray-900 outline-none dark:bg-gray-800 dark:text-gray-100"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <Folder size={14} className="mr-2 shrink-0 text-gray-400" />
                    <button
                      onClick={() => navTo(`/notes?folder=${encodeURIComponent(name)}`)}
                      className="flex-1 text-left"
                    >
                      {name}
                    </button>
                    <div className="hidden items-center gap-0.5 group-hover:flex">
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenaming(name); setRenameValue(name); }}
                        className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="重命名"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(name); }}
                        className="rounded p-0.5 text-gray-400 hover:text-red-500"
                        title="删除"
                      >
                        <Close size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* 新建文件夹输入框 */}
            {newFolderInput !== null && (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <input
                  type="text"
                  value={newFolderInput}
                  onChange={(e) => setNewFolderInput(e.target.value)}
                  placeholder="文件夹名称"
                  className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") { setNewFolderInput(""); }
                  }}
                  autoFocus
                />
                <button
                  onClick={handleCreateFolder}
                  className="rounded px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
                >
                  确定
                </button>
              </div>
            )}

            {/* 新建按钮 */}
            <button
              onClick={() => {
                setNewFolderInput("");
                // focus will be handled by the autoFocus on the input
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
            >
              <Plus size={14} />
              新建文件夹
            </button>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center justify-center border-t border-gray-200 p-3 text-gray-400 hover:text-gray-600 dark:border-gray-700 dark:hover:text-gray-300"
        aria-label="折叠侧边栏"
      >
        <ChevronLeft size={18} />
      </button>
    </div>
  );
}
