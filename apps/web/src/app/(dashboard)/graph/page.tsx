"use client";

import { KnowledgeGraph } from "@/components/graph/KnowledgeGraph";

export default function GraphPage() {
  return (
    <div className="mx-auto h-[calc(100vh-4rem)] max-w-7xl">
      <KnowledgeGraph />
    </div>
  );
}
