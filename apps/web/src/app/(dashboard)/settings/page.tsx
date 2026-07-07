"use client";

import { Switch } from "@ai-notes/ui-kit";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        设置
      </h1>
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          通用
        </h2>
        <div className="space-y-4">
          <Switch label="自动保存笔记" defaultChecked />
          <Switch label="启用 AI 建议" defaultChecked />
          <Switch label="Markdown 快捷键" defaultChecked />
        </div>
      </div>
    </div>
  );
}
