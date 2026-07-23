"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { getNotes } from "@/lib/storage";
import { buildGraphData, type GraphNode, type GraphData } from "@/lib/wikilinks";
import { getNodeColor, getGroupColor } from "./graph-colors";
import { GraphSidebar, type GroupStat } from "./GraphSidebar";
import { Search as SearchIcon, Close } from "@ai-notes/icons";

// react-force-graph 会原地改造 node/link 对象（注入 x/y/vx/vy、把 link.source/target 换成对象引用）
type FGNode = GraphNode & { x?: number; y?: number; fx?: number; fy?: number; vx?: number; vy?: number };
type FGLink = {
  source: string | FGNode;
  target: string | FGNode;
  weak: boolean;
};

// 取 link 端点 id（兼容「字符串 id」与「力模拟后变为节点对象」两种情况）
function endpointId(end: string | FGNode): string {
  return typeof end === "object" ? end.id : end;
}

// react-force-graph 自带类型未暴露具体力对象的方法（distance/strength），
// 这里仅声明用到的部分，避免到处使用 `as any`。
type D3ForceInstance = {
  distance?: (fn: (link: FGLink) => number) => void;
  strength?: (value: number) => void;
  initialize?: (nodes: FGNode[], ...rest: unknown[]) => void;
};
type D3ForceFn = {
  (name: string): D3ForceInstance | undefined;
  (name: string, force: D3ForceInstance | null): void;
};

export default function ForceGraphInner() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined);
  const didInitialFit = useRef(false);

  const [raw, setRaw] = useState<GraphData | null>(null);
  const [dims, setDims] = useState({ width: 800, height: 600 });
  const [hoverNode, setHoverNode] = useState<FGNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<FGNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  // ── 加载数据 ──
  const loadGraph = useCallback(() => setRaw(buildGraphData()), []);
  useEffect(() => {
    loadGraph();
    const handler = () => loadGraph();
    window.addEventListener("ai-notes:note-changed", handler);
    return () => window.removeEventListener("ai-notes:note-changed", handler);
  }, [loadGraph]);

  // ── 容器尺寸自适应 ──
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      setDims({ width: r.width || 800, height: r.height || 600 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [raw]);

  // ── 构建 react-force-graph 数据（含分组过滤） ──
  const graphData = useMemo(() => {
    if (!raw) return { nodes: [] as FGNode[], links: [] as FGLink[] };
    const nodes: FGNode[] = raw.nodes.map((n) => ({ ...n }));
    const links: FGLink[] = raw.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weak: e.weak,
    }));
    if (!activeGroup) return { nodes, links };
    // 分组过滤：只保留该分组节点及其之间的连线
    const keep = new Set(
      nodes.filter((n) => (n.group || "默认") === activeGroup).map((n) => n.id)
    );
    const fNodes = nodes.filter((n) => keep.has(n.id));
    const fLinks = links.filter(
      (l) => keep.has(endpointId(l.source)) && keep.has(endpointId(l.target))
    );
    return { nodes: fNodes, links: fLinks };
  }, [raw, activeGroup]);

  // ── 邻接表（用于悬停/选中高亮邻居） ──
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of graphData.links) {
      const s = endpointId(l.source);
      const t = endpointId(l.target);
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s)!.add(t);
      map.get(t)!.add(s);
    }
    return map;
  }, [graphData]);

  // 标准 d3-like 力对象，避免缺少 initialize 导致运行时错误
  const collideForce: D3ForceInstance = (() => {
    let nodes: FGNode[] = [];
    const force = (alpha: number) => {
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = (b.x ?? 0) - (a.x ?? 0);
          const dy = (b.y ?? 0) - (a.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = 26; // 节点中心最小距离，给标签留空间
          if (dist < minDist) {
            const rep = ((minDist - dist) / dist) * alpha * 0.6;
            const offsetX = dx * rep * 0.5;
            const offsetY = dy * rep * 0.5;
            a.vx = (a.vx || 0) - offsetX;
            a.vy = (a.vy || 0) - offsetY;
            b.vx = (b.vx || 0) + offsetX;
            b.vy = (b.vy || 0) + offsetY;
          }
        }
      }
    };
    force.initialize = (n: FGNode[]) => {
      nodes = n;
    };
    return force;
  })();

  // ── 力参数：弱边(标签)拉远、强边(双链)拉近；加碰撞防止重叠 ──
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const d3Force = fg.d3Force as unknown as D3ForceFn;
    const linkForce = d3Force("link");
    if (linkForce?.distance) linkForce.distance((l: FGLink) => (l.weak ? 120 : 80));
    const chargeForce = d3Force("charge");
    if (chargeForce?.strength) chargeForce.strength(-300);
    d3Force("collide", collideForce);
    fg.d3ReheatSimulation();
  }, [graphData, collideForce]);

  const searchMatch = useCallback(
    (n: FGNode) => searchQuery && n.title.toLowerCase().includes(searchQuery.toLowerCase()),
    [searchQuery]
  );

  // 当前用于高亮的焦点节点（悬停优先，其次选中）
  const focusId = hoverNode?.id || selectedNode?.id || null;
  const neighborIds = focusId ? adjacency.get(focusId) : undefined;

  const isDimmed = useCallback(
    (n: FGNode): boolean => {
      if (searchQuery) return !searchMatch(n);
      if (!focusId) return false;
      if (n.id === focusId) return false;
      return !(neighborIds?.has(n.id));
    },
    [searchQuery, searchMatch, focusId, neighborIds]
  );

  // ── 节点绘制 ──
  const nodeCanvasObject = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      // 固定小节点：不再按连接数大幅放大，避免小图里节点巨大互相重叠
      const radius = 6;
      const isIsolated = node.links === 0;
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoverNode?.id === node.id;
      const dim = isDimmed(node);
      const color = getNodeColor(node);
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      // 光晕
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 10, 0, Math.PI * 2);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 节点圆
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.globalAlpha = dim ? 0.15 : 1;
      ctx.fillStyle = color;
      ctx.fill();

      // 选中/悬停边框
      if (isSelected || isHovered) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // 孤立节点：虚线灰环
      if (isIsolated && !isSelected && !isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = "rgba(156,163,175,0.7)";
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 标签文字：按像素估算宽度截断（中英文混排时宽度差异大）
      const showLabel =
        isHovered || isSelected || (node.links >= 1 && !dim) || (!!searchQuery && searchMatch(node));
      if (showLabel && globalScale > 0.35) {
        const fontSize = (isHovered || isSelected ? 12 : 10) / globalScale;
        ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.globalAlpha = dim ? 0.25 : 0.9;
        ctx.fillStyle = "rgba(148,163,184,0.95)";
        const maxLabelWidth = 120 / globalScale; // 限制渲染宽度约 120 屏幕像素
        let label = node.title;
        if (ctx.measureText(label).width > maxLabelWidth) {
          let truncated = label;
          while (
            truncated.length > 1 &&
            ctx.measureText(truncated + "…").width > maxLabelWidth
          ) {
            truncated = truncated.slice(0, -1);
          }
          label = truncated + "…";
        }
        ctx.fillText(label, x, y + radius + 6 / globalScale);
      }

      ctx.globalAlpha = 1;
    },
    [selectedNode, hoverNode, isDimmed, searchQuery, searchMatch]
  );

  // ── 边样式：双链实线主题色、标签虚线灰；高亮焦点邻边 ──
  const linkColor = useCallback(
    (l: FGLink) => {
      const s = endpointId(l.source);
      const t = endpointId(l.target);
      const highlighted = focusId && (s === focusId || t === focusId);
      const searchHi =
        searchQuery &&
        graphData.nodes.some((n) => n.id === s && searchMatch(n)) &&
        graphData.nodes.some((n) => n.id === t && searchMatch(n));
      if (highlighted || searchHi) return l.weak ? "rgba(148,163,184,0.9)" : "rgba(99,102,241,0.9)";
      if (focusId || searchQuery) return "rgba(148,163,184,0.06)";
      return l.weak ? "rgba(148,163,184,0.25)" : "rgba(99,102,241,0.45)";
    },
    [focusId, searchQuery, graphData, searchMatch]
  );

  const linkWidth = useCallback(
    (l: FGLink) => {
      const s = endpointId(l.source);
      const t = endpointId(l.target);
      const highlighted = focusId && (s === focusId || t === focusId);
      return highlighted ? 2 : l.weak ? 0.5 : 1.2;
    },
    [focusId]
  );

  const linkLineDash = useCallback((l: FGLink) => (l.weak ? [3, 3] : null), []);

  // ── 交互 ──
  const handleNodeClick = useCallback(
    (node: FGNode) => {
      setSelectedNode((prev) => (prev?.id === node.id ? null : node));
    },
    []
  );

  const handleNodeDblClick = useCallback(
    (node: FGNode) => {
      router.push(`/edit?id=${node.id}`);
    },
    [router]
  );

  const handleToggleGroup = useCallback((group: string) => {
    setActiveGroup((prev) => (prev === group ? null : group));
  }, []);

  const handleOpenNote = useCallback(
    (id: string) => {
      router.push(`/edit?id=${id}`);
    },
    [router]
  );

  // ── 统计与图例 ──
  const groupStats = useMemo<GroupStat[]>(() => {
    if (!raw) return [];
    const groups = Array.from(new Set(raw.nodes.map((n) => n.group || "默认")));
    return groups.map((g) => ({
      group: g,
      color: getGroupColor(g),
      count: raw.nodes.filter((n) => (n.group || "默认") === g).length,
    }));
  }, [raw]);

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">知识图谱</h2>
          {raw && (
            <span className="text-sm text-gray-400">
              {graphData.nodes.length} 个节点 · {graphData.links.length} 条连接
              {activeGroup && (
                <button
                  onClick={() => setActiveGroup(null)}
                  className="ml-2 text-brand-500 hover:underline"
                >
                  （已筛选「{activeGroup}」· 点此清除）
                </button>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索笔记..."
              className="w-48 rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-8 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <Close size={14} />
              </button>
            )}
          </div>

          <button
            onClick={() => fgRef.current?.zoom((fgRef.current.zoom() || 1) * 1.2, 300)}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            title="放大"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <button
            onClick={() => fgRef.current?.zoom((fgRef.current.zoom() || 1) / 1.2, 300)}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            title="缩小"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <button
            onClick={() => fgRef.current?.zoomToFit(400, 40)}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            title="适应视图"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
          </button>
        </div>
      </div>

      {/* 主体 */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={containerRef} className="relative flex-1 bg-gray-50 dark:bg-gray-950">
          {raw && graphData.nodes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <circle cx="4" cy="8" r="2" />
                <circle cx="20" cy="8" r="2" />
                <circle cx="6" cy="18" r="2" />
                <circle cx="18" cy="18" r="2" />
                <line x1="10" y1="10" x2="5.5" y2="9" />
                <line x1="14" y1="10" x2="18.5" y2="9" />
                <line x1="10.5" y1="14" x2="7" y2="17" />
                <line x1="13.5" y1="14" x2="17" y2="17" />
              </svg>
              <p className="mt-4 text-sm">暂无笔记连接</p>
              <p className="mt-1 text-xs text-gray-300 dark:text-gray-600">
                在编辑器中使用 [[笔记标题]] 创建链接
              </p>
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              width={dims.width}
              height={dims.height}
              graphData={graphData}
              backgroundColor="rgba(0,0,0,0)"
              nodeRelSize={6}
              nodeLabel={() => ""}
              nodeCanvasObject={nodeCanvasObject}
              nodePointerAreaPaint={(node: FGNode, color, ctx) => {
                const radius = 6;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x ?? 0, node.y ?? 0, radius + 6, 0, Math.PI * 2);
                ctx.fill();
              }}
              linkColor={linkColor}
              linkWidth={linkWidth}
              linkLineDash={linkLineDash}
              onNodeClick={handleNodeClick}
              onNodeRightClick={handleNodeDblClick}
              onNodeHover={(n: FGNode | null) => setHoverNode(n)}
              onBackgroundClick={() => setSelectedNode(null)}
              onNodeDragEnd={(node: FGNode) => {
                node.fx = node.x;
                node.fy = node.y;
              }}
              cooldownTicks={160}
              onEngineStop={() => {
                // 仅首次力模拟停止时自动缩放一次，避免后续交互时画面跳动
                if (!didInitialFit.current) {
                  didInitialFit.current = true;
                  fgRef.current?.zoomToFit(400, 60);
                }
              }}
            />
          )}
        </div>

        {/* 侧边栏（筛选 / 图例 / 选中信息） */}
        <GraphSidebar
          groupStats={groupStats}
          activeGroup={activeGroup}
          onToggleGroup={handleToggleGroup}
          selectedNode={selectedNode}
          onOpenNote={handleOpenNote}
        />
      </div>
    </div>
  );
}
