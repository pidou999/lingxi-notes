/**
 * 知识图谱颜色方案：节点颜色、分组配色、边配色等。
 * 从 ForceGraphInner 中提取，便于复用与测试。
 */
import type { GraphNode } from "@/lib/wikilinks";

export const PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#a855f7", "#d946ef", "#f43f5e", "#fb923c", "#a3e635",
];

/** 孤立节点（无任何连接）配色 */
export const ISOLATED_COLOR = "#9ca3af";
/** 双链强边配色 */
export const BRAND = "#6366f1";
/** 标签弱边配色 */
export const TAG_EDGE = "#9ca3af";

// 缓存分组 -> 颜色，保证同一分组在所有节点/图例上颜色一致
const GROUP_COLORS: Record<string, string> = {};

/** 根据分组名稳定地分配一个调色板颜色 */
export function getGroupColor(group: string): string {
  if (GROUP_COLORS[group]) return GROUP_COLORS[group];
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = group.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = PALETTE[Math.abs(hash) % PALETTE.length];
  GROUP_COLORS[group] = color;
  return color;
}

/** 节点填充色：孤立节点用灰色，否则用分组配色 */
export function getNodeColor(node: GraphNode): string {
  return (node.links ?? 0) === 0 ? ISOLATED_COLOR : getGroupColor(node.group || "默认");
}
