"use client";

import type { GraphNode } from "@/lib/wikilinks";
import { BRAND, TAG_EDGE, ISOLATED_COLOR } from "./graph-colors";

export interface GroupStat {
  group: string;
  color: string;
  count: number;
}

interface GraphSidebarProps {
  groupStats: GroupStat[];
  activeGroup: string | null;
  onToggleGroup: (group: string) => void;
  selectedNode: GraphNode | null;
  onOpenNote: (id: string) => void;
}

/**
 * 知识图谱侧边栏：分组筛选、连线图例、选中节点信息、操作说明。
 * 接收筛选状态与回调，保持与 ForceGraphInner 原有交互完全一致。
 */
export function GraphSidebar({
  groupStats,
  activeGroup,
  onToggleGroup,
  selectedNode,
  onOpenNote,
}: GraphSidebarProps) {
  return (
    <div className="w-64 shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
        分组（点击筛选）
      </h3>
      <div className="space-y-1">
        {groupStats.slice(0, 15).map((g) => {
          const isActive = activeGroup === g.group;
          return (
            <button
              key={g.group}
              onClick={() => onToggleGroup(g.group)}
              aria-pressed={isActive}
              className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors ${
                isActive
                  ? "bg-brand-50 font-medium text-brand-600 ring-1 ring-inset ring-brand-500/50 dark:bg-brand-900/40 dark:text-brand-300"
                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
              <span className={`truncate ${isActive ? "font-medium text-brand-600 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"}`}>
                {g.group}
              </span>
              <span className="ml-auto text-xs text-gray-400">{g.count}</span>
            </button>
          );
        })}
        {groupStats.length > 15 && (
          <p className="text-xs text-gray-400">还有 {groupStats.length - 15} 个分组...</p>
        )}
      </div>

      {/* 边类型图例 */}
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-gray-400">
        连线类型
      </h3>
      <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
        <div className="flex items-center gap-2">
          <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke={BRAND} strokeWidth="2" /></svg>
          <span>双链（强关联）</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke={TAG_EDGE} strokeWidth="1.5" strokeDasharray="3 3" /></svg>
          <span>共享标签（弱关联）</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="24" height="12"><circle cx="6" cy="6" r="4" fill="none" stroke={ISOLATED_COLOR} strokeWidth="1" strokeDasharray="2 2" /></svg>
          <span>孤立笔记（待整理）</span>
        </div>
      </div>

      {/* 选中节点信息 */}
      {selectedNode && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            选中笔记
          </h3>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="font-medium text-gray-900 dark:text-gray-100">{selectedNode.title}</p>
            <p className="mt-1 text-xs text-gray-400">{selectedNode.links} 条连接</p>
            {selectedNode.links === 0 && (
              <p className="mt-1 text-xs text-amber-500">暂无关联，建议打标签或加 [[双链]]</p>
            )}
            {selectedNode.tags && selectedNode.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedNode.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-brand-50 px-1.5 py-0.5 text-xs text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={() => onOpenNote(selectedNode.id)}
              className="mt-3 w-full rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              打开笔记
            </button>
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div className="mt-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">操作</h3>
        <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
          <p>🖱️ 单击节点 — 选中并高亮邻居</p>
          <p>🖱️ 悬停节点 — 高亮关联</p>
          <p>🖱️ 右键节点 — 打开笔记</p>
          <p>🖱️ 拖拽节点 — 固定位置</p>
          <p>🔄 滚轮 — 缩放 · 拖背景 — 平移</p>
          <p>🏷️ 点分组 — 只看该子图</p>
        </div>
      </div>
    </div>
  );
}
