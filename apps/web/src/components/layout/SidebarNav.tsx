"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, type SidebarItem } from "@ai-notes/ui-kit";
import {
  Note,
  Bookmark,
  Ai,
  Tag,
  Folder,
  ChevronLeft,
} from "@ai-notes/icons";
import { LingxiLogo } from "./LingxiLogo";

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

  const items: SidebarItem[] = useMemo(
    () => [
      {
        id: "notes",
        label: "笔记",
        icon: <Note size={20} />,
        href: "/notes",
        active: pathname.startsWith("/notes"),
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
        id: "folders",
        label: "文件夹",
        icon: <Folder size={20} />,
        children: [
          {
            id: "import",
            label: "导入",
            icon: <Folder size={16} />,
            href: "/settings",
          },
        ],
      },
    ],
    [pathname]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Brand logo */}
      <div className="px-4 pt-4 pb-2">
        <LingxiLogo collapsed={collapsed} />
      </div>

      <Sidebar
        items={items}
        collapsed={collapsed}
        onItemClick={onItemClick}
        className="flex-1"
      />

      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center justify-center border-t border-gray-200 p-3 text-gray-400 hover:text-gray-600 dark:border-gray-700 dark:hover:text-gray-300"
        aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
      >
        <ChevronLeft
          size={18}
          className={`transition-transform ${
            collapsed ? "rotate-180" : ""
          }`}
        />
      </button>
    </div>
  );
}
