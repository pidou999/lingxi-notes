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
  Star,
  MoreHorizontal,
} from "@ai-notes/icons";
import { LingxiLogo } from "./LingxiLogo";
import { getFolders, renameFolder, deleteFolder, createFolder, createNote, updateNote } from "@/lib/storage";

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
  const [showNewFolder, setShowNewFolder] = useState(false);
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
    onItemClick?.({} as any);
    // 关闭新建文件夹输入框
    setShowNewFolder(false);
    setNewFolderInput("");
    setSubfolderParent(null);
  };

  // 新建文件夹
  const handleCreateFolder = () => {
    const name = newFolderInput.trim();
    if (!name) return;
    // 如果是创建子文件夹，拼接父路径
    const fullName = subfolderParent ? `${subfolderParent}/${name}` : name;
    createFolder(fullName);
    refreshFolders();
    setShowNewFolder(false);
    setNewFolderInput("");
    setSubfolderParent(null);
  };

  // 重命名
  const handleRename = (oldName: string) => {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) {
      setRenaming(null);
      return;
    }
    // 如果是子文件夹，保留父路径前缀
    const fullNewName = isSubfolder(oldName)
      ? oldName.split("/").slice(0, -1).concat(newName).join("/")
      : newName;
    renameFolder(oldName, fullNewName);
    // 同时更新子文件夹的路径（父文件夹改名时）
    if (!isSubfolder(oldName)) {
      getChildrenOf(oldName).forEach((child) => {
        const childNewName = child.replace(oldName, fullNewName);
        renameFolder(child, childNewName);
      });
    }
    refreshFolders();
    setRenaming(null);
  };

  // 删除文件夹
  const handleDeleteFolder = (name: string) => {
    if (!confirm(`确定删除文件夹「${name}」？笔记不会被删除，但会移出此文件夹。`)) return;
    deleteFolder(name);
    refreshFolders();
  };

  // 文件夹内联菜单
  const [folderMenu, setFolderMenu] = useState<string | null>(null);
  // 记录从哪个父文件夹点击的"新建子文件夹"，null 表示根层级
  const [subfolderParent, setSubfolderParent] = useState<string | null>(null);

  // 是否为子文件夹（含 / 分隔符）
  const isSubfolder = (name: string) => name.includes("/");
  // 获取父文件夹名
  const getParent = (name: string) => isSubfolder(name) ? name.split("/").slice(0, -1).join("/") : "";
  // 获取本层名称（去掉父路径前缀）
  const getBaseName = (name: string) => isSubfolder(name) ? name.split("/").pop()! : name;

  // 按层级组织文件夹：root → child
  const rootFolders = folders.filter((f) => !isSubfolder(f));
  const childFolders = folders.filter((f) => isSubfolder(f));
  const getChildrenOf = (parent: string) =>
    childFolders.filter((f) => f.startsWith(parent + "/")).sort();

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
            onClick={() => navTo(`/notes?folder=${encodeURIComponent(name)}`)}
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
                      navTo(`/edit?id=${note.id}`);
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

  const mainItems: SidebarItem[] = [
    {
      id: "notes",
      label: "笔记",
      icon: <Note size={20} />,
      href: "/notes",
      active: pathname.startsWith("/notes") && !pathname.includes("starred"),
    },
    {
      id: "starred",
      label: "星标",
      icon: <Star size={20} />,
      href: "/starred",
      active: pathname.startsWith("/starred"),
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
      href: "/tags",
      active: pathname.startsWith("/tags"),
    },
  ];

  // ── 折叠态 ──────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-4 pt-4 pb-2">
          <LingxiLogo collapsed={true} />
        </div>

        {/* 主菜单（侧边栏组件） */}
        <Sidebar
          items={mainItems}
          collapsed={true}
          onItemClick={(item) => item.href && navTo(item.href)}
          className="flex-1"
        />

        {/* 回收站 */}
        <button
          type="button"
          onClick={() => navTo("/trash")}
          className={`flex items-center justify-center p-3 transition-colors ${
            pathname.startsWith("/trash")
              ? "text-brand-600 dark:text-brand-400"
              : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
          aria-label="回收站"
        >
          <Trash2 size={20} />
        </button>

        {/* 折叠按钮 */}
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

  // ── 展开态 ──────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-2">
        <LingxiLogo collapsed={false} />
      </div>

      {/* 主菜单 */}
      <Sidebar
        items={mainItems}
        collapsed={false}
        onItemClick={(item) => item.href && navTo(item.href)}
        className="flex-shrink-0"
      />

      {/* 文件夹区域（无 border-t） */}
      <div className="mx-2 mt-2">
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
            {rootFolders.map((rootName) => (
              <div key={rootName}>
                {/* ── 根文件夹 ── */}
                <RenderFolder name={rootName} displayName={rootName} />

                {/* ── 子文件夹 ── */}
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

      {/* 回收站（在文件夹下方） */}
      <button
        onClick={() => navTo("/trash")}
        className={`mx-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          pathname.startsWith("/trash")
            ? "bg-brand-50 font-medium text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        }`}
      >
        <Trash2 size={20} />
        <span>回收站</span>
      </button>

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
