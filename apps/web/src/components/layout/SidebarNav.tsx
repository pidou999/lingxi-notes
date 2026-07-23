"use client";

import { useState } from "react";
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
  Graph,
} from "@ai-notes/icons";
import { LingxiLogo } from "./LingxiLogo";
import { FolderSection } from "./FolderSection";

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

  // 导航 — 统一处理路由跳转 + 重置状态
  const navTo = (href: string) => {
    router.push(href);
    onItemClick?.({} as any);
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
    {
      id: "graph",
      label: "图谱",
      icon: <Graph size={20} />,
      href: "/graph",
      active: pathname.startsWith("/graph"),
    },
  ];

  // ── 折叠态 ──────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-4 pt-4 pb-2 flex items-center justify-center">
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
          onClick={() => navTo("/trash")}
          title="回收站"
          aria-label="回收站"
          className={`flex items-center justify-center p-3 transition-colors ${
            pathname.startsWith("/trash")
              ? "text-brand-600 dark:text-brand-400"
              : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
        >
          <Trash2 size={20} />
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          title="展开侧边栏"
          aria-label="展开侧边栏"
          className="flex items-center justify-center border-t border-gray-200 p-3 text-gray-400 hover:text-gray-600 dark:border-gray-700 dark:hover:text-gray-300"
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

      <Sidebar
        items={mainItems}
        collapsed={false}
        onItemClick={(item) => item.href && navTo(item.href)}
        className="flex-shrink-0"
      />

      {/* 文件夹区域 — 独立组件 */}
      <FolderSection onNavigate={(href) => navTo(href)} />

      {/* 回收站 */}
      <button
        onClick={() => navTo("/trash")}
        className={`mx-3 mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
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
