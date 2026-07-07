"use client";

import { useState, useEffect } from "react";
import { Button, Input, Switch } from "@ai-notes/ui-kit";
import { Trash2, Plus } from "@ai-notes/icons";
import {
  getSiteCookies,
  saveSiteCookies,
  type SiteCookie,
} from "@/lib/cookies";

export default function SettingsPage() {
  const [cookies, setCookies] = useState<SiteCookie[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [newCookie, setNewCookie] = useState("");

  useEffect(() => {
    setCookies(getSiteCookies());
  }, []);

  const handleAdd = () => {
    if (!newDomain.trim() || !newCookie.trim()) return;
    const item: SiteCookie = {
      id: crypto.randomUUID(),
      domain: newDomain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, ""),
      cookie: newCookie.trim(),
      enabled: true,
    };
    const updated = [...cookies, item];
    setCookies(updated);
    saveSiteCookies(updated);
    setNewDomain("");
    setNewCookie("");
  };

  const handleRemove = (id: string) => {
    const updated = cookies.filter((c) => c.id !== id);
    setCookies(updated);
    saveSiteCookies(updated);
  };

  const handleToggle = (id: string) => {
    const updated = cookies.map((c) =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    );
    setCookies(updated);
    saveSiteCookies(updated);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        设置
      </h1>

      {/* ── 通用 ── */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          通用
        </h2>
        <div className="space-y-4">
          <Switch label="自动保存笔记" defaultChecked />
          <Switch label="启用 AI 建议" defaultChecked />
          <Switch label="Markdown 快捷键" defaultChecked />
        </div>
      </div>

      {/* ── 抓取配置 ── */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          抓取配置
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          配置各网站的 Cookie，抓取需要登录才能访问的内容时会自动带上。
          在浏览器开发者工具中登录目标网站后，复制 Cookie 字符串粘贴到下方。
        </p>

        {/* Cookie 列表 */}
        {cookies.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            暂无配置，添加一个吧
          </p>
        ) : (
          <div className="space-y-2">
            {cookies.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {c.domain}
                  </p>
                  <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                    {c.cookie.substring(0, 50)}
                    {c.cookie.length > 50 ? "..." : ""}
                  </p>
                </div>
                <Switch
                  checked={c.enabled}
                  onChange={() => handleToggle(c.id)}
                />
                <button
                  onClick={() => handleRemove(c.id)}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                  aria-label="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 新增配置 */}
        <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
          <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            新增配置
          </h3>
          <div className="space-y-3">
            <Input
              placeholder="域名，如 zhihu.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
            />
            <Input
              placeholder="Cookie 字符串（从浏览器复制）"
              value={newCookie}
              onChange={(e) => setNewCookie(e.target.value)}
            />
            <Button
              onClick={handleAdd}
              size="sm"
              disabled={!newDomain.trim() || !newCookie.trim()}
            >
              <Plus size={16} />
              添加
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
