"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon, User, LogOut, Server, Team, Settings, ChevronDown, Plus } from "@ai-notes/icons";
import { Button, Switch } from "@ai-notes/ui-kit";
import { useAuth } from "@/lib/auth";
import {
  getAllModels,
  getSelectedModel,
  setSelectedModel,
  type ModelOption,
} from "@/lib/providers";
import { TopBarSearch } from "./TopBarSearch";
import { AddModelModal } from "../providers/AddModelModal";

/* ════════════ SwitchRow ════════════ */

function SwitchRow({
  label,
  description,
  defaultChecked,
}: {
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <Switch checked={checked} onChange={(e) => setChecked(e.target.checked)} />
    </div>
  );
}

/* ════════════ TopBar ════════════ */

export function TopBar() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModelState] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  const refreshModels = useCallback(() => {
    setModels(getAllModels());
    setSelectedModelState(getSelectedModel());
  }, []);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  // 监听变化：跨 tab（storage 事件）+ 同 tab（自定义事件）
  useEffect(() => {
    const onStorage = () => refreshModels();
    window.addEventListener("storage", onStorage);
    const onProvidersChange = () => refreshModels();
    window.addEventListener("providers-changed", onProvidersChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("providers-changed", onProvidersChange);
    };
  }, [refreshModels]);

  const handleSelectModel = (m: ModelOption) => {
    setSelectedModel(m.id);
    setSelectedModelState(m.id);
    setModelOpen(false);
  };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelOpen(false);
    };
    if (menuOpen || modelOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen, modelOpen]);

  const isDark = mounted && (theme === "dark" || resolvedTheme === "dark");
  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  return (
    <header className="relative z-[60] flex h-14 items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950">
      {/* 左侧：搜索 */}
      <div className="flex flex-1 items-center gap-2">
        <TopBarSearch />
      </div>

      {/* 右侧：模型切换、主题、用户 */}
      <div className="flex items-center gap-2">
        {/* 模型切换 - 始终显示 */}
        <div className="relative" ref={modelRef}>
          <button
            onClick={() => setModelOpen(!modelOpen)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="切换模型"
          >
            <Server size={14} />
            <span className="max-w-[120px] truncate">
              {currentModel?.modelName || "选择模型"}
            </span>
            <ChevronDown size={12} />
          </button>

          {modelOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
              {models.length > 0 ? (
                <div className="max-h-64 overflow-y-auto">
                  {(() => {
                    const groups: Record<string, ModelOption[]> = {};
                    for (const m of models) {
                      if (!groups[m.providerName]) groups[m.providerName] = [];
                      groups[m.providerName].push(m);
                    }
                    return Object.entries(groups).map(([providerName, items]) => (
                      <div key={providerName}>
                        <div className="border-b border-gray-100 px-3 py-1.5 text-xs font-medium text-gray-400 dark:border-gray-800 dark:text-gray-500">
                          {providerName}
                        </div>
                        {items.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => handleSelectModel(m)}
                            className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                              selectedModel === m.id
                                ? "bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                                : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                            }`}
                          >
                            <span className="flex-1 truncate">{m.modelName}</span>
                            {selectedModel === m.id && (
                              <span className="ml-2 text-brand-500">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className="px-3 py-4 text-center">
                  <p className="mb-1 text-sm text-gray-400 dark:text-gray-500">暂无模型</p>
                  <p className="text-xs text-gray-300 dark:text-gray-600">请添加 API 服务商和模型</p>
                </div>
              )}
              {/* 添加模型按钮 */}
              <div className="border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => {
                    setModelOpen(false);
                    setAddModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
                >
                  <Plus size={14} />
                  添加模型
                </button>
              </div>
            </div>
          )}
        </div>

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
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
              aria-label="用户菜单"
            >
              {user?.username?.charAt(0).toUpperCase() || <User size={18} />}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.username}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                </div>
                <button
                  disabled
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-400 opacity-60 dark:text-gray-500"
                  title="即将开放"
                >
                  <Server size={16} />
                  多端同步（即将开放）
                </button>
                <button
                  onClick={() => { setMenuOpen(false); router.push("/team"); }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Team size={16} />
                  团队
                </button>
                <button
                  onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Settings size={16} />
                  设置
                </button>
                <button
                  onClick={() => { setMenuOpen(false); logout().then(() => router.push("/login")); }}
                  className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:border-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <LogOut size={16} />
                  退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => router.push("/login")} className="p-2">
            登录
          </Button>
        )}
      </div>

      {/* 添加模型弹窗 */}
      <AddModelModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={refreshModels}
      />
    </header>
  );
}
