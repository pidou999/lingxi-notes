"use client";

import dynamic from "next/dynamic";

// react-force-graph-2d 依赖 window/canvas，必须禁用 SSR
const ForceGraphInner = dynamic(() => import("./ForceGraphInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      正在加载知识图谱…
    </div>
  ),
});

export function KnowledgeGraph() {
  return <ForceGraphInner />;
}
