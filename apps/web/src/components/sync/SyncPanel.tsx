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

    setResult({ ok, fail });
    setSyncing(false);
  }, []);

  if (!user) return null;

  return (
    <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-800">
      <div className="mb-2 px-1 text-xs text-gray-400">
        {user.username}
      </div>

      {result && (
        <div className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
          同步完成：成功 {result.ok} 条，失败 {result.fail} 条
        </div>
      )}

      {!result && (
        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800 dark:text-gray-400"
        >
          {syncing ? "同步中..." : "↑ 同步本地数据到服务器"}
        </button>
      )}

      {result && (
        <button
          onClick={() => setResult(null)}
          className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400"
        >
          再同步一次
        </button>
      )}

      <button
        onClick={logout}
        className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        退出登录
      </button>
    </div>
  );
}
