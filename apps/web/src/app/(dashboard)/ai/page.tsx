"use client";

import { Ai } from "@ai-notes/icons";

export default function AiPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        AI 助手
      </h1>
      <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-12 dark:border-gray-700">
        <div className="text-center">
          <Ai size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            AI 功能即将上线
          </p>
        </div>
      </div>
    </div>
  );
}
