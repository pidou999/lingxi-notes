"use client";

import { Folder } from "@ai-notes/icons";

export default function CollectionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        标签与文件夹
      </h1>
      <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-12 dark:border-gray-700">
        <div className="text-center">
          <Folder size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            创建文件夹和标签来组织你的笔记
          </p>
        </div>
      </div>
    </div>
  );
}
