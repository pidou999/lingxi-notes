"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { apiCreateNote, apiCreateProvider } from "@/lib/api";
import { getNotes } from "@/lib/storage";
import { getProviders } from "@/lib/providers";

export function SyncPanel() {
  const { user, logout } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number } | null>(null);

  const handleSync = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    setResult(null);

    let ok = 0;
    let fail = 0;

    // 同步笔记
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

    // 同步服务商
    try {
      const providers = getProviders();
      for (const p of providers) {
        try {
          await apiCreateProvider({
            type: p.type,
            name: p.name,
            baseUrl: p.baseUrl,
            apiKey: p.apiKey,
            protocol: p.protocol,
            models: JSON.stringify(p.models || []),
          });
          ok++;
        } catch {
          fail++;
        }
      }
    } catch {
      // getProviders 可能失败
    }

    setResult({ ok, fail });
    setSyncing(false);
  }, [user]);

  if (!user) return null;

  return (
    <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
      <div className="mb-1 truncate font-medium text-gray-700 dark:text-gray-300">
        {user.username || "用户"}
      </div>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <span className={`${syncing ? "animate-spin" : ""}`}>⟳</span>
        {syncing ? "同步中..." : result ? `已同步 ${result.ok}，失败 ${result.fail}` : "同步到服务器"}
      </button>
      <button
        onClick={logout}
        className="mt-1 w-full rounded px-2 py-1 text-left text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
      >
        退出登录
      </button>
    </div>
  );
}
