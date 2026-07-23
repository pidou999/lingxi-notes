"use client";

import { useState, useEffect, useCallback } from "react";
import type { SearchFilterRule } from "@/lib/search-filter";
import { getAllRules, setRules, resetRules } from "@/lib/search-filter";

export function SearchFilterPanel() {
  const [rules, setLocalRules] = useState<SearchFilterRule[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  const loadRules = useCallback(() => {
    setLocalRules(getAllRules());
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const toggleRule = (id: string) => {
    const updated = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    setLocalRules(updated);
    setRules(updated);
    window.dispatchEvent(new Event("search-filters-changed"));
  };

  const handleReset = () => {
    resetRules();
    loadRules();
    window.dispatchEvent(new Event("search-filters-changed"));
  };

  if (!showPanel) {
    return (
      <button
        onClick={() => setShowPanel(true)}
        className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
        title="搜索结果过滤设置"
      >
        ⚙ 过滤规则
      </button>
    );
  }

  return (
    <div className="mt-2 border border-neutral-700 rounded-lg p-3 bg-neutral-900">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-neutral-300">搜索结果过滤规则</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="text-[10px] text-neutral-500 hover:text-neutral-300"
          >
            重置默认
          </button>
          <button
            onClick={() => setShowPanel(false)}
            className="text-neutral-500 hover:text-neutral-300"
          >
            ✕
          </button>
        </div>
      </div>
      <p className="text-[10px] text-neutral-500 mb-2">
        开启的规则将在搜索结果中过滤匹配项。修改即时生效。
      </p>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {rules.map((rule) => (
          <label
            key={rule.id}
            className="flex items-start gap-2 py-0.5 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={() => toggleRule(rule.id)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-neutral-300 truncate">
                {rule.type === "domain" ? "🌐 " : "🔑 "}
                {rule.pattern}
              </div>
              {rule.note && (
                <div className="text-[10px] text-neutral-500 truncate">
                  {rule.note}
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
