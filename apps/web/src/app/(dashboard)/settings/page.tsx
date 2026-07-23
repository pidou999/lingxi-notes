"use client";

import { useState, useEffect } from "react";
import { Button, Input, Switch } from "@ai-notes/ui-kit";
import { Trash2, Plus, Settings as SettingsIcon, Link, ExternalLink } from "@ai-notes/icons";
import {
  getSiteCookies,
  saveSiteCookies,
  type SiteCookie,
} from "@/lib/cookies";
import { ProviderSection } from "@/components/providers/ProviderSection";

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
      id: crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
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
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        设置
      </h1>

      {/* ── 通用 ── */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <SettingsIcon size={20} className="text-gray-400" />
            通用
          </h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <SwitchRow
            label="自动保存笔记"
            description="编辑时自动保存内容，防止丢失"
            defaultChecked
          />
          <SwitchRow
            label="启用 AI 建议"
            description="在编辑器中显示 AI 辅助建议"
            defaultChecked
          />
          <SwitchRow
            label="Markdown 快捷键"
            description="启用快捷键快速插入 Markdown 语法"
            defaultChecked
          />
        </div>
      </div>

      {/* ── 抓取配置 ── */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <Link size={20} className="text-gray-400" />
            抓取配置
          </h2>
          <div className="mt-2 space-y-2 text-sm text-gray-500 dark:text-gray-400">
            <p>
              配置各网站的 Cookie，抓取需要登录才能访问的内容时会自动带上。
            </p>
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              <p className="font-medium mb-1">📋 从 Chrome 复制 Cookie 的正确方法：</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>打开 Chrome → 登录 <code className="text-xs bg-amber-100/50 dark:bg-amber-800/30 px-1 rounded">zhihu.com</code></li>
                <li>按 <kbd className="px-1.5 py-0.5 rounded border border-amber-300/50 bg-amber-100/50 dark:border-amber-700/50 dark:bg-amber-800/30 text-xs">F12</kbd> 打开开发者工具</li>
                <li>进入 <strong>Application</strong> → <strong>Cookies</strong> → <code className="text-xs bg-amber-100/50 dark:bg-amber-800/30 px-1 rounded">zhihu.com</code></li>
                <li>在列表上 <strong>右键</strong> → <strong>全选</strong>（或点第一条后按住 Shift 点最后一条）</li>
                <li>右键 → <strong>复制</strong>（或按 <kbd className="px-1.5 py-0.5 rounded border border-amber-300/50 bg-amber-100/50 dark:border-amber-700/50 dark:bg-amber-800/30 text-xs">Ctrl+C</kbd>）</li>
                <li>回到这里，把域名设为 <code className="text-xs bg-amber-100/50 dark:bg-amber-800/30 px-1 rounded">zhihu.com</code>，Cookie 粘贴到下方输入框</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Cookie 列表 */}
        <div className="px-6 py-4">
          {cookies.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <ExternalLink size={32} className="text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400 dark:text-gray-500">
                暂无 Cookie 配置
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                添加一个配置即可抓取知乎等需要登录的网站
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cookies.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/30"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                      {c.domain}
                    </span>
                    <code className="truncate text-xs text-gray-400 dark:text-gray-500">
                      {c.cookie.substring(0, 60)}
                      {c.cookie.length > 60 ? "..." : ""}
                    </code>
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
        </div>

        {/* 新增配置 — 输入框同一行 */}
        <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            新增配置
          </h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-44">
              <Input
                placeholder="域名，如 zhihu.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Input
                placeholder="Cookie 字符串（从浏览器复制）"
                value={newCookie}
                onChange={(e) => setNewCookie(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={!newDomain.trim() || !newCookie.trim()}
              className="shrink-0"
            >
              <Plus size={16} />
              添加
            </Button>
          </div>
        </div>
      </div>

      {/* ── 模型配置 ── */}
      <ProviderSection />
    </div>
  );
}

// ── 开关行组件（无 label 文字，只有开关） ──

function SwitchRow({
  label,
  description,
  defaultChecked,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked ?? true);

  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {label}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onChange={() => setChecked(!checked)}
      />
    </div>
  );
}
