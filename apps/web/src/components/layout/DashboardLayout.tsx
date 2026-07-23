"use client";

import { useState, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SidebarNav } from "./SidebarNav";
import { TopBar } from "./TopBar";
import { useRequireAuth } from "@/lib/auth";
import { Note, Bookmark, Ai, Settings, Trash2 } from "@ai-notes/icons";
import Link from "next/link";
import type { SidebarItem } from "@ai-notes/ui-kit";

export interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isLoading } = useRequireAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isAiPage = pathname === "/ai";

  const handleNavClick = useCallback(
    (item: SidebarItem | null | undefined) => {
      if (item?.href) {
        router.push(item.href);
      }
    },
    [router]
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950">
      {/* Sidebar - desktop */}
      <aside
        className={`hidden flex-col border-r border-gray-200 bg-gray-50 transition-all duration-200 dark:border-gray-800 dark:bg-gray-900 md:flex ${
          sidebarCollapsed ? "w-16" : "w-60"
        }`}
      >
        <SidebarNav
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onItemClick={handleNavClick}
        />
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-gray-200 bg-white py-2 md:hidden dark:border-gray-800 dark:bg-gray-950"
        aria-label="移动端导航"
      >
        <MobileNavItem icon={<Note size={20} />} label="笔记" href="/notes" />
        <MobileNavItem
          icon={<Bookmark size={20} />}
          label="收藏"
          href="/bookmarks"
        />
        <MobileNavItem icon={<Ai size={20} />} label="AI" href="/ai" />
        <MobileNavItem icon={<Trash2 size={20} />} label="回收站" href="/trash" />
        <MobileNavItem
          icon={<Settings size={20} />}
          label="设置"
          href="/settings"
        />
      </nav>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className={`flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 ${isAiPage ? "" : "p-4 md:p-6"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

function MobileNavItem({
  icon,
  label,
  href,
}: {
  icon: ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Link>
  );
}
