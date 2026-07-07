"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon, User, LogOut, Export } from "@ai-notes/icons";
import { Button } from "@ai-notes/ui-kit";
import { useAuth } from "@/lib/auth";
import { apiCreateNote, apiCreateProvider } from "@/lib/api";
import { getNotes } from "@/lib/storage";
import { getProviders } from "@/lib/providers";

export function TopBar() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: number; fail: number } | null>(null);
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

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    let ok = 0;
    let fail = 0;

    const notes = getNotes();
    for (const note of notes) {
      try {
        await apiCreateNote({
          title: note.title || "",
          html: note.html || "",
          json: note.json ? JSON.stringify(note.json) : "{}",
          tags: JSON.stringify(note.tags || []),
        });
        ok++;
      } catch {
        fail++;
      }
    }

    const providers = getProviders();
    for (const p of providers) {
      try {
        await apiCreateProvider({
          type: p.type,
          name: p.name,
          baseUrl: p.baseUrl,
          apiKey: p.apiKey,
          protocol: p.protocol,
          models: JSON.stringify(p.models),
        });
        ok++;
      } catch {
        fail++;
      }
    }

    setSyncResult({ ok, fail });
    setSyncing(false);
  }, []);

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

                {/* 同步结果 */}
                {syncResult && (
                  <div className="mx-3 my-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    同步完成：成功 {syncResult.ok} 条，失败 {syncResult.fail} 条
                    <button
                      onClick={() => setSyncResult(null)}
                      className="ml-2 underline"
                    >
                      清除
                    </button>
                  </div>
                )}

                {/* 同步按钮 */}
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Export size={16} />
                  {syncing ? "同步中..." : "同步本地数据到服务器"}
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
