import type { Note } from "./types";

/**
 * 从 HTML 中提取纯文本
 */
export function htmlToText(html: string): string {
  if (!html) return "";
  // 移除 HTML 标签
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 关键词搜索：匹配标题 + 纯文本内容
 */
export function keywordSearch(notes: Note[], query: string): Note[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  return notes.filter((note) => {
    const title = note.title.toLowerCase();
    const text = htmlToText(note.html).toLowerCase();
    return title.includes(q) || text.includes(q);
  });
}

/**
 * 构建 AI 语义搜索的 prompt
 */
export function buildSemanticSearchPrompt(
  query: string,
  notes: Note[]
): { role: string; content: string }[] {
  const list = notes.map(
    (n, i) =>
      `${i + 1}. [${n.title || "无标题"}]\n   摘要：${htmlToText(n.html).slice(0, 200)}`
  );

  return [
    {
      role: "system",
      content:
        "你是灵犀笔记助手，一个智能搜索助手。用户输入搜索关键词，你需要从以下笔记列表中找出最相关的结果。" +
        "请返回一个 JSON 数组，包含匹配结果的序号和匹配原因。格式严格如下：\n" +
        '```json\n[{"index": 1, "reason": "笔记内容匹配了..."}]\n```\n' +
        "如果没有任何匹配，返回空数组 []。只输出 JSON，不要其他内容。",
    },
    {
      role: "user",
      content: `搜索关键词：${query}\n\n笔记列表：\n${list.join("\n\n")}`,
    },
  ];
}

/**
 * 解析 AI 返回的 JSON 结果
 */
export function parseSearchResult(
  raw: string,
  notes: Note[]
): { note: Note; reason: string }[] {
  try {
    // 尝试从返回中提取 JSON
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const json = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    if (!Array.isArray(json)) return [];
    return json
      .filter((item: any) => typeof item.index === "number")
      .map((item: any) => ({
        note: notes[item.index - 1],
        reason: item.reason || "",
      }))
      .filter((r) => r.note);
  } catch {
    // 解析失败时回退：将全文作为匹配返回
    return notes.length > 0
      ? [{ note: notes[0], reason: "AI 搜索完成" }]
      : [];
  }
}
