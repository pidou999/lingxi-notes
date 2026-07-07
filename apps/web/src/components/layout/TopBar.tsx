"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon, User, LogOut, Server } from "@ai-notes/icons";
import { Button } from "@ai-notes/ui-kit";
import { useAuth } from "@/lib/auth";

export function TopBar() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const isDark = mounted && (theme === "dark" || resolvedTheme === "dark");

  return (
    <header className="flex h-14 items-center justify-end gap-2 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "切换到亮色模式" : "切换到暗色模式"}
          className="p-2"
        >
          {mounted && isDark ? <Sun size={18} /> : <Moon size={18} />}
        </Button>

        {user ? (
          /* 已登录：用户头像 + 下拉菜单 */
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
              aria-label="用户菜单"
            >
              {user?.username?.charAt(0).toUpperCase() || <User size={18} />}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user.username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user.email}
                  </p>
                </div>

                {/* 多端同步占位 */}
                <button
                  disabled
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-400 opacity-60 dark:text-gray-500"
                  title="即将开放"
                >
                  <Server size={16} />
                  多端同步（即将开放）
                </button>

                {/* 退出登录 */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    router.push("/login");
                  }}
                  className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:border-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <LogOut size={16} />
                  退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          /* 未登录：显示登录按钮 */
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/login")}
            className="p-2"
          >
            登录
          </Button>
        )}
      </div>
    </header>
  );
}
