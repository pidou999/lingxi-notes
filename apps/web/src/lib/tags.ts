import type { Note } from "./types";
import { htmlToText } from "./search";

/**
 * 构建 AI 标签推荐的 prompt
 */
export function tagPrompt(note: Note): { role: string; content: string }[] {
  const text = htmlToText(note.html).slice(0, 2000);
  return [
    {
      role: "system",
      content:
        "你是一个标签推荐助手。根据笔记的标题和内容，推荐 3-5 个最相关的标签。" +
        "标签可以是中文或英文，用短语而非句子。直接返回 JSON 数组，例如：[\"AI\", \"深度学习\", \"笔记\"]\n" +
        "只输出数组，不要其他内容。",
    },
    {
      role: "user",
      content: `标题：${note.title || "无标题"}\n\n内容：${text.slice(0, 1500)}`,
    },
  ];
}

/**
 * 解析 AI 返回的标签 JSON
 */
export function parseTagResult(raw: string): string[] {
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const tags = JSON.parse(match[0]);
    if (!Array.isArray(tags)) return [];
    return tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);
  } catch {
    return [];
  }
}
