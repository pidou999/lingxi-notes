"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon, User, LogOut, Server, Team, Settings, ChevronDown } from "@ai-notes/icons";
import { Button } from "@ai-notes/ui-kit";
import { useAuth } from "@/lib/auth";
import { getAllModels, getSelectedModel, setSelectedModel, type ModelOption } from "@/lib/providers";

export function TopBar() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModelState] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  // 加载模型列表和已选模型
  useEffect(() => {
    setModels(getAllModels());
    setSelectedModelState(getSelectedModel());
  }, []);

  // 监听 localStorage 变化（其他 tab 或设置页修改时刷新）
  useEffect(() => {
    const handler = () => {
      setModels(getAllModels());
      setSelectedModelState(getSelectedModel());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const handleSelectModel = (m: ModelOption) => {
    setSelectedModel(m.id);
    setSelectedModelState(m.id);
    setModelOpen(false);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    };
    if (menuOpen || modelOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen, modelOpen]);

  const isDark = mounted && (theme === "dark" || resolvedTheme === "dark");

  // 当前选中的模型信息
  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  return (
    <header className="relative z-[60] flex h-14 items-center justify-end gap-2 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center gap-2">
        {/* 模型切换 */}
        {models.length > 0 && (
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
                <div className="max-h-64 overflow-y-auto">
                  {/* 按提供商分组 */}
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
                {models.length === 0 && (
                  <p className="px-3 py-4 text-center text-sm text-gray-400">
                    暂无已配置的模型
                  </p>
                )}
              </div>
            )}
          </div>
        )}

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
              <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
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

                {/* 团队 */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/team");
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Team size={16} />
                  团队
                </button>

                {/* 设置 */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/settings");
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Settings size={16} />
                  设置
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
