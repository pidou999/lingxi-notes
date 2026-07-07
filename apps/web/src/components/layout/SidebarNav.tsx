"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, type SidebarItem } from "@ai-notes/ui-kit";
import {
  Note,
  Bookmark,
  Ai,
  Tag,
  Settings,
  Team,
  Folder,
  ChevronLeft,
  Search,
  Cpu,
} from "@ai-notes/icons";

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

  const bottomItems: SidebarItem[] = useMemo(
    () => [
      {
        id: "team",
        label: "团队",
        icon: <Team size={20} />,
        href: "/team",
        active: pathname.startsWith("/team"),
      },
      {
        id: "providers",
        label: "模型配置",
        icon: <Cpu size={20} />,
        href: "/providers",
        active: pathname.startsWith("/providers"),
      },
      {
        id: "settings",
        label: "设置",
        icon: <Settings size={20} />,
        href: "/settings",
        active: pathname.startsWith("/settings"),
      },
    ],
    [pathname]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Search - click to jump to notes page with search */}
      <div className="px-3 pt-3 pb-1">
        <button
          type="button"
          onClick={() => router.push("/notes")}
          className={`flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-colors hover:border-brand-300 hover:ring-1 hover:ring-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500 ${
            collapsed ? "justify-center px-2" : ""
          }`}
        >
          <Search size={16} className="shrink-0 text-gray-400" />
          {!collapsed && (
            <span className="min-w-0 flex-1 text-left text-gray-400">
              搜索笔记...
            </span>
          )}
        </button>
      </div>

      <Sidebar
        items={items}
        collapsed={collapsed}
        onItemClick={onItemClick}
        className="flex-1"
      />

      <div className="border-t border-gray-200 dark:border-gray-700">
        <Sidebar
          items={bottomItems}
          collapsed={collapsed}
          onItemClick={onItemClick}
        />
      </div>

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
