/**
 * 双向链接（Wiki Links）核心逻辑
 *
 * 语法：[[笔记标题]] 或 [[笔记标题|显示文字]]
 *
 * 存储在笔记 HTML 中为：<a data-wikilink="笔记ID" href="/edit?id=笔记ID">显示文字</a>
 * 编辑器输入 [[ 时触发自动补全
 */

import { getNotes } from "./storage";
import type { Note } from "./types";

// ─── 解析 ──────────────────────────────────────────

/** 从文本中提取所有 [[wikilink]] 引用 */
export function parseWikiLinks(text: string): { target: string; label: string }[] {
  const regex = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
  const results: { target: string; label: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    results.push({
      target: match[1].trim(),
      label: match[2]?.trim() || match[1].trim(),
    });
  }
  return results;
}

/** 从 HTML 中提取所有 data-wikilink 引用 */
export function parseWikiLinksFromHtml(html: string): { targetId: string; label: string }[] {
  const regex = /data-wikilink="([^"]+)"[^>]*>(.*?)<\/a>/g;
  const results: { targetId: string; label: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    results.push({
      targetId: match[1],
      label: match[2].replace(/<[^>]*>/g, "").trim(),
    });
  }
  return results;
}

// ─── 匹配 ──────────────────────────────────────────

/** 根据标题查找笔记（精确匹配优先，然后前缀匹配，然后包含匹配） */
export function findNoteByTitle(title: string): Note | undefined {
  const notes = getNotes();
  // 精确匹配
  const exact = notes.find((n) => n.title === title);
  if (exact) return exact;
  // 前缀匹配
  const prefix = notes.find((n) => n.title.startsWith(title));
  if (prefix) return prefix;
  // 包含匹配
  const contains = notes.find((n) => n.title.includes(title));
  return contains;
}

/** 模糊搜索笔记标题（用于自动补全） */
export function searchNotesForWiki(query: string): { id: string; title: string }[] {
  if (!query.trim()) return [];
  const notes = getNotes();
  const q = query.toLowerCase();
  return notes
    .filter((n) => n.title.toLowerCase().includes(q))
    .slice(0, 10)
    .map((n) => ({ id: n.id, title: n.title }));
}

// ─── 转换 ──────────────────────────────────────────

/** 将 [[wikilink]] 文本转换为 HTML 链接 */
export function wikiLinksToHtml(text: string): string {
  return text.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_match, target, label) => {
    const displayText = label || target;
    const note = findNoteByTitle(target.trim());
    if (note) {
      return `<a data-wikilink="${note.id}" href="/edit?id=${note.id}" class="wikilink">${displayText}</a>`;
    }
    // 未找到目标笔记，显示为红色虚线链接
    return `<a data-wikilink-missing="${target.trim()}" class="wikilink wikilink-missing">${displayText}</a>`;
  });
}

/** 将 HTML 中的 wikilink 转换回 [[wikilink]] 文本 */
export function htmlToWikiLinks(html: string): string {
  // 先处理带 data-wikilink 的链接
  let result = html.replace(
    /<a[^>]*data-wikilink="([^"]+)"[^>]*>(.*?)<\/a>/g,
    (_match, _id, label) => {
      const text = label.replace(/<[^>]*>/g, "").trim();
      return `[[${text}]]`;
    }
  );
  // 处理未找到目标的链接
  result = result.replace(
    /<a[^>]*data-wikilink-missing="([^"]+)"[^>]*>(.*?)<\/a>/g,
    (_match, target, label) => {
      const text = label.replace(/<[^>]*>/g, "").trim();
      if (text === target) return `[[${target}]]`;
      return `[[${target}|${text}]]`;
    }
  );
  return result;
}

// ─── 反向链接 ──────────────────────────────────────────

export interface Backlink {
  noteId: string;
  noteTitle: string;
  /** 引用上下文（引用位置前后各截取一段文字） */
  context: string;
  updatedAt: string;
}

/** 获取所有引用了指定笔记的其他笔记 */
export function getBacklinks(noteId: string): Backlink[] {
  const notes = getNotes();
  const results: Backlink[] = [];

  for (const note of notes) {
    if (note.id === noteId) continue;
    if (!note.html) continue;

    // 检查 HTML 中是否包含 data-wikilink 指向该笔记
    const links = parseWikiLinksFromHtml(note.html);
    const hasLink = links.some((l) => l.targetId === noteId);
    if (!hasLink) continue;

    // 提取引用上下文
    const contexts: string[] = [];
    const regex = new RegExp(
      `data-wikilink="${noteId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>(.*?)<\\/a>`,
      "g"
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(note.html)) !== null) {
      const plainHtml = note.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
      const linkText = match[1].replace(/<[^>]*>/g, "");
      const idx = plainHtml.indexOf(linkText);
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(plainHtml.length, idx + linkText.length + 40);
        contexts.push(
          (start > 0 ? "..." : "") +
          plainHtml.slice(start, end).trim() +
          (end < plainHtml.length ? "..." : "")
        );
      } else {
        contexts.push(linkText);
      }
    }

    results.push({
      noteId: note.id,
      noteTitle: note.title || "未命名笔记",
      context: contexts.join("；") || `引用了此笔记`,
      updatedAt: note.updatedAt,
    });
  }

  return results;
}

// ─── 图谱数据 ──────────────────────────────────────────

export interface GraphNode {
  id: string;
  title: string;
  /** 连接数（度） */
  links: number;
  /** 笔记标签 */
  tags?: string[];
  /** 分组：用首层文件夹或首个标签 */
  group?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  /** 是否为标签弱关联（区别于双链强关联，决定力导向中的理想距离） */
  weak: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** 构建完整知识图谱数据 */
export function buildGraphData(): GraphData {
  const notes = getNotes();
  const nodeMap = new Map<string, GraphNode>();
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];

  // 1. 创建所有节点
  for (const note of notes) {
    nodeMap.set(note.id, {
      id: note.id,
      title: note.title || "未命名笔记",
      links: 0,
      tags: note.tags,
      group: note.folder?.split("/")[0] || note.tags?.[0] || "默认",
    });
  }

  // 2. 从 HTML 中提取 wikilink 关系
  for (const note of notes) {
    if (!note.html) continue;
    const links = parseWikiLinksFromHtml(note.html);
    for (const link of links) {
      const targetId = link.targetId;
      if (!nodeMap.has(targetId)) continue;
      if (targetId === note.id) continue; // 不自引用

      const edgeKey = [note.id, targetId].sort().join("-");
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edges.push({ source: note.id, target: targetId, weak: false });
        // 更新度数
        const src = nodeMap.get(note.id);
        const tgt = nodeMap.get(targetId);
        if (src) src.links++;
        if (tgt) tgt.links++;
      }
    }
  }

  // 3. 从共享标签建立弱关联（同标签 = 弱连接）
  const tagNotesMap = new Map<string, string[]>();
  for (const note of notes) {
    if (!note.tags) continue;
    for (const tag of note.tags) {
      if (!tagNotesMap.has(tag)) tagNotesMap.set(tag, []);
      tagNotesMap.get(tag)!.push(note.id);
    }
  }
  const MAX_TAG_EDGES = 50; // 每个标签最多建 50 条弱边，避免大标签 O(n²) 爆炸又把整组丢弃
  for (const [_tag, noteIds] of tagNotesMap) {
    // 同标签下每对笔记建立弱关联；标签笔记过少(<2)跳过，过多则限制边数而非整组丢弃
    if (noteIds.length < 2) continue;
    let tagEdgeCount = 0;
    for (let i = 0; i < noteIds.length && tagEdgeCount < MAX_TAG_EDGES; i++) {
      for (let j = i + 1; j < noteIds.length && tagEdgeCount < MAX_TAG_EDGES; j++) {
        const edgeKey = [noteIds[i], noteIds[j]].sort().join("-");
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({ source: noteIds[i], target: noteIds[j], weak: true });
          const src = nodeMap.get(noteIds[i]);
          const tgt = nodeMap.get(noteIds[j]);
          if (src) src.links++;
          if (tgt) tgt.links++;
          tagEdgeCount++;
        }
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}
