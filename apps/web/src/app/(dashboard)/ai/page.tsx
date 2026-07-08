"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Ai,
  Loader2,
  Send,
  Save,
  Folder,
  Tag,
  Check,
  Sparkles,
  FileText,
  Edit,
  Plus,
  Trash2,
  Square,
  MoreHorizontal,
} from "@ai-notes/icons";
import { chatCompletion, getProviders, getSelectedModel, resolveModel } from "@/lib/providers";
import { createNote, updateNote, deleteNote, getNotes, getFolders, createFolder, deleteFolder, renameFolder } from "@/lib/storage";
import { LingxiLogo } from "@/components/layout/LingxiLogo";

// ── 类型 ──────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  noteData?: {
    title: string;
    html: string;
    folder: string;
    tags: string[];
  };
  organizeData?: {
    noteId: string;
    noteTitle: string;
    currentFolder: string;
    suggestedFolder: string;
    suggestedTags: string[];
  }[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// ── 存储 ──────────────────────────────────────────

const CONV_STORAGE_KEY = "ai-notes:conversations";
const ACTIVE_CONV_KEY = "ai-notes:active-conv";

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONV_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify(convs));
}

function loadActiveConvId(): string | null {
  return localStorage.getItem(ACTIVE_CONV_KEY);
}

function saveActiveConvId(id: string) {
  localStorage.setItem(ACTIVE_CONV_KEY, id);
}

// ── 提示词 ────────────────────────────────────────

const WRITE_NOTE_SYSTEM_PROMPT = `你是灵犀笔记助手。当用户要求你写一篇笔记时，你需要：
1. 根据用户的要求生成一篇完整、有内容的笔记
2. 自动推荐一个合适的文件夹名称
3. 自动推荐 3-5 个相关标签

你的回复必须严格遵循以下 JSON 格式（不要包含任何其他内容，只输出 JSON）：
{
  "title": "笔记标题",
  "html": "<p>笔记内容（HTML 格式）</p>",
  "folder": "文件夹名称",
  "tags": ["标签1", "标签2", "标签3"]
}

重要规则：
- **优先使用已有文件夹**：如果已有文件夹中有与笔记主题相关的，直接使用该文件夹，不要新建
- 如果已有文件夹都不合适，才新建文件夹
- 如果笔记适合放在某个已有文件夹下作为子分类，使用"父文件夹/子分类"格式，例如"软件工具/网络工具"
- html 字段必须是合法的 HTML，使用 <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>, <code>, <pre>, <blockquote>, <a> 等标签
- 文件夹名称应该简洁明了
- 标签应该能准确描述笔记内容`;

const ORGANIZE_SYSTEM_PROMPT = `你是灵犀笔记助手。当用户要求整理笔记时，你需要：
1. 分析用户提供的未整理笔记列表
2. 为每篇笔记推荐合适的文件夹和标签
3. 如果发现可以归为同一类的笔记，使用相同的文件夹名

重要规则：
- **优先使用已有文件夹**：已有文件夹列表会提供给你，如果有匹配的文件夹，直接使用，不要新建
- 如果已有文件夹中有主题相近但不完全匹配的，可以创建为该文件夹的子文件夹，使用"父文件夹/子分类"格式
- 只有当完全没有合适的已有文件夹时，才新建根级文件夹
- 标签应该与笔记内容高度相关
- 同类笔记应该归入同一文件夹

你的回复必须严格遵循以下 JSON 格式（不要包含任何其他内容，只输出 JSON）：
{
  "suggestions": [
    {
      "noteId": "笔记ID",
      "noteTitle": "笔记标题",
      "currentFolder": "当前文件夹（可能为空）",
      "suggestedFolder": "建议的文件夹",
      "suggestedTags": ["建议标签1", "建议标签2"]
    }
  ]
}`;

const CREATE_FOLDER_SYSTEM_PROMPT = `你是灵犀笔记助手。用户要求你创建一个文件夹。
请根据用户的要求，确定文件夹名称。

重要规则：
- **优先使用已有文件夹**：如果用户提到的文件夹已在列表中，直接回复告知已存在
- 如果需要新建，考虑是否应该作为某个已有文件夹的子文件夹，使用"父文件夹/子分类"格式
- 名称应该简洁明了

你的回复必须严格遵循以下 JSON 格式（不要包含任何其他内容，只输出 JSON）：
{
  "action": "create_folder",
  "name": "文件夹名称（如果已存在则为空字符串）"
}`;

const RENAME_FOLDER_SYSTEM_PROMPT = `你是灵犀笔记助手。用户要求重命名一个文件夹。
请根据用户的要求，确定原文件夹名称和新名称。

用户已有的文件夹列表会在系统消息中提供。
请确认用户提到的文件夹是否存在，如果不存在则告知。

你的回复必须严格遵循以下 JSON 格式（不要包含任何其他内容，只输出 JSON）：
{
  "action": "rename_folder",
  "oldName": "原文件夹名称",
  "newName": "新文件夹名称"
}`;

const DELETE_FOLDER_SYSTEM_PROMPT = `你是灵犀笔记助手。用户要求删除一个文件夹。
请根据用户的要求，确定要删除的文件夹名称。

用户已有的文件夹列表会在系统消息中提供。
请确认用户提到的文件夹是否存在。

你的回复必须严格遵循以下 JSON 格式（不要包含任何其他内容，只输出 JSON）：
{
  "action": "delete_folder",
  "name": "要删除的文件夹名称"
}`;

const DELETE_NOTE_SYSTEM_PROMPT = `你是灵犀笔记助手。用户要求删除一篇笔记。
请根据用户的要求，确定要删除的笔记。

用户已有的笔记列表会在系统消息中提供。
请根据用户描述（标题或内容）找到匹配的笔记。

你的回复必须严格遵循以下 JSON 格式（不要包含任何其他内容，只输出 JSON）：
{
  "action": "delete_note",
  "noteId": "笔记ID",
  "noteTitle": "笔记标题"
}`;

// ── 工具 ──────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function genConvTitle(msgs: Message[]): string {
  const firstUser = msgs.find((m) => m.role === "user");
  if (!firstUser) return "新对话";
  const text = firstUser.content.slice(0, 24);
  return text.length < firstUser.content.length ? text + "…" : text;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

// ── 主组件 ────────────────────────────────────────

export default function AiPage() {
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [convMenu, setConvMenu] = useState<string | null>(null);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editInputValue, setEditInputValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1200);
  }, []);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const convs = loadConversations();
    setConversations(convs);
    const activeId = loadActiveConvId();
    if (activeId && convs.find((c) => c.id === activeId)) {
      setActiveConvId(activeId);
      setMessages(convs.find((c) => c.id === activeId)!.messages);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const persistConv = useCallback(
    (msgs: Message[], convId?: string) => {
      const id = convId || activeConvId;
      if (!id) return;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === id);
        const updated = [...prev];
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], messages: msgs, updatedAt: new Date().toISOString(), title: genConvTitle(msgs) };
        }
        saveConversations(updated);
        return updated;
      });
    },
    [activeConvId]
  );

  // ── 操作 ──────────────────────────────────────

  const handleNewConv = () => {
    const id = generateId();
    const conv: Conversation = {
      id, title: "新对话", messages: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const updated = [conv, ...conversations];
    setConversations(updated);
    saveConversations(updated);
    setActiveConvId(id);
    saveActiveConvId(id);
    setMessages([]);
    setInput("");
  };

  const handleSwitchConv = (id: string) => {
    if (id === activeConvId) return;
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setActiveConvId(id);
    saveActiveConvId(id);
    setMessages(conv.messages);
    setInput("");
  };

  const handleDeleteConv = (id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    saveConversations(updated);
    if (id === activeConvId) {
      const next = updated[0];
      setActiveConvId(next?.id || null);
      saveActiveConvId(next?.id || "");
      setMessages(next?.messages || []);
    }
  };

  const handleRenameConv = (id: string) => {
    const val = renameValue.trim();
    if (!val) { setRenamingConvId(null); return; }
    setConversations((prev) => {
      const updated = prev.map((c) => c.id === id ? { ...c, title: val } : c);
      saveConversations(updated);
      return updated;
    });
    setRenamingConvId(null);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  const getProvider = useCallback(() => {
    const selectedId = getSelectedModel();
    if (selectedId) {
      const resolved = resolveModel(selectedId);
      if (resolved) return resolved;
    }
    const providers = getProviders().filter((p) => p.models.length > 0);
    if (providers.length === 0) return null;
    const p = providers[0];
    return { provider: p, model: p.models[0] };
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    let currentId = activeConvId;
    if (!currentId) {
      const id = generateId();
      const conv: Conversation = {
        id, title: "新对话", messages: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      const updated = [conv, ...conversations];
      setConversations(updated);
      saveConversations(updated);
      setActiveConvId(id);
      saveActiveConvId(id);
      currentId = id;
    }

    const providerInfo = getProvider();
    if (!providerInfo) {
      const assistantMsg: Message = { id: generateId(), role: "assistant", content: "请先在「设置 → 模型配置」页面添加服务商和模型。" };
      const newMsgs = [...messages, assistantMsg];
      setMessages(newMsgs);
      persistConv(newMsgs, currentId);
      return;
    }

    const userMsg: Message = { id: generateId(), role: "user", content: text };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const isWriteRequest = /帮我写|写一篇|创建.*笔记|新建.*笔记|生成.*笔记/.test(text);
      const isOrganizeRequest = /整理笔记|整理.*笔记|归类|分类/.test(text);
      const isCreateFolderRequest = /创建.*文件夹|新建.*文件夹|添加.*文件夹|新增.*文件夹/.test(text);
      const isRenameFolderRequest = /重命名.*文件夹|改.*文件夹名|文件夹.*改名|文件夹.*重命名|重命名.*目录/.test(text);
      const isDeleteFolderRequest = /删除.*文件夹|移除.*文件夹|删除.*目录/.test(text);
      const isDeleteNoteRequest = /删除.*笔记|移除.*笔记|删除.*文章|移除.*文章/.test(text);

      let systemPrompt = "";
      let assistantMsg: Message | undefined;
      const existingFolders = getFolders();
      const folderListStr = existingFolders.length > 0
        ? `\n\n用户已有的文件夹列表：${existingFolders.join("、")}\n请优先使用这些文件夹。如果需要子分类，使用"父文件夹/子分类"格式。`
        : "\n\n用户目前没有任何文件夹，你可以自由创建。";

      if (isCreateFolderRequest) {
        // 直接尝试从用户文本提取文件夹名（无需调 AI）
        // 先尝试子文件夹：在xxx下创建一个yyy文件夹 / 在xxx下新建一个yyy的子文件夹
        // 关键：显式跳过(?:一个|个)?量词，用非贪婪(.{2,}?)捕获最小名称，让后面的(?:文件夹|目录)匹配边界
        const subfolderPattern = /在\s*(.+?)\s*(?:文件夹|目录)?\s*(?:下|中|里|内)\s*(?:创建|新建|添加|新增)(?:一个|个)?\s*"?([^\n]{2,}?)"?\s*(?:的)?\s*(?:文件夹|目录|子文件夹)/;
        const subfolderMatch = text.match(subfolderPattern);
        if (subfolderMatch) {
          let name = subfolderMatch[2].trim();
          let parent = subfolderMatch[1].trim();
          if (name && parent) {
            // 查找已有文件夹：如果 parent 是某个已有文件夹路径的"尾部"，使用完整路径
            // 例如：parent="878787"，已有"1111/878787" → 使用"1111/878787"作为父级
            // 这样在"在878787下创建777777"时会得到"1111/878787/777777"
            const matchedParents = existingFolders.filter(
              f => f === parent || f.endsWith("/" + parent)
            );
            if (matchedParents.length > 0) {
              // 优先精确匹配，否则取最深的（最长路径）
              const exact = matchedParents.find(f => f === parent);
              parent = exact || matchedParents.sort((a, b) => b.length - a.length)[0];
            }
            const fullName = `${parent}/${name}`;
            if (existingFolders.includes(fullName)) {
              assistantMsg = { id: generateId(), role: "assistant", content: `文件夹「${fullName}」已存在。` };
            } else {
              createFolder(fullName);
              window.dispatchEvent(new CustomEvent("ai-notes:folder-changed"));
              assistantMsg = { id: generateId(), role: "assistant", content: `✅ 已创建文件夹「${fullName}」。` };
            }
            setMessages([...newMsgs, assistantMsg!]);
            persistConv([...newMsgs, assistantMsg!], currentId);
            setLoading(false);
            abortRef.current = null;
            return;
          }
        }
        // 普通文件夹名提取 — 非贪婪捕获，让后面的关键词做边界
        let name: string | null = null;
        // 模式1a：创建[一个/个]"XXX"的文件夹（有"的"分隔）— 如"创建一个11111的文件夹"
        const beforeMatch1 = text.match(/(?:创建|新建|添加|新增)(?:一个|个)?\s*"?([^\n]{2,}?)"?\s*(?:的)\s*(?:文件夹|目录)/);
        if (beforeMatch1) {
          name = beforeMatch1[1].trim();
        }
        // 模式1b：创建[一个/个]XXX文件夹（无"的"）— 如"创建一个测试文件夹"、"创建一个电影文件夹"
        if (!name) {
          const beforeMatch2 = text.match(/(?:创建|新建|添加|新增)(?:一个|个)?\s*"?([^\n]{2,}?)"?\s*(?:文件夹|目录)/);
          if (beforeMatch2) name = beforeMatch2[1].trim();
        }
        // 模式2：创建文件夹XXX / 新建目录XXX — 名称在关键词之后
        if (!name) {
          const afterMatch = text.match(/(?:创建|新建|添加|新增).*?(?:文件夹|目录)\s*"?([^"!？。，,\n]+)"?/);
          if (afterMatch) name = afterMatch[1].trim();
        }
        if (name) {
          // 兜底清理：去掉可能的量词前缀和关键词后缀
          name = name.replace(/^一个|^个/, "").replace(/的$/, "").replace(/文件夹$|目录$/, "").trim();
          if (!name || name.length < 1) {
            systemPrompt = CREATE_FOLDER_SYSTEM_PROMPT + folderListStr;
          } else if (existingFolders.includes(name)) {
            assistantMsg = { id: generateId(), role: "assistant", content: `文件夹「${name}」已存在。` };
          } else {
            createFolder(name);
            window.dispatchEvent(new CustomEvent("ai-notes:folder-changed"));
            assistantMsg = { id: generateId(), role: "assistant", content: `✅ 已创建文件夹「${name}」。` };
          }
          if (assistantMsg) {
            setMessages([...newMsgs, assistantMsg]);
            persistConv([...newMsgs, assistantMsg], currentId);
            setLoading(false);
            abortRef.current = null;
            return;
          }
        }
        // 无法直接从文本提取，调 AI
        systemPrompt = CREATE_FOLDER_SYSTEM_PROMPT + folderListStr;
      } else if (isRenameFolderRequest) {
        const renameMatch = text.match(/(?:把|将)\s*(.+?)\s*(?:改名为|重命名为|改为|改成)\s*(.+)/);
        if (renameMatch) {
          const oldName = renameMatch[1].trim();
          const newName = renameMatch[2].trim();
          if (!existingFolders.includes(oldName)) {
            assistantMsg = { id: generateId(), role: "assistant", content: `文件夹「${oldName}」不存在。` };
          } else if (existingFolders.includes(newName)) {
            assistantMsg = { id: generateId(), role: "assistant", content: `文件夹「${newName}」已存在。` };
          } else {
            renameFolder(oldName, newName);
            window.dispatchEvent(new CustomEvent("ai-notes:folder-changed"));
            assistantMsg = { id: generateId(), role: "assistant", content: `✅ 已重命名「${oldName}」→「${newName}」。` };
          }
          setMessages([...newMsgs, assistantMsg!]);
          persistConv([...newMsgs, assistantMsg!], currentId);
          setLoading(false);
          abortRef.current = null;
          return;
        }
        systemPrompt = RENAME_FOLDER_SYSTEM_PROMPT + folderListStr;
      } else if (isDeleteFolderRequest) {
        const deleteFolderMatch = text.match(/(?:删除|移除)\s*(?:文件夹|目录)\s*(.+)/);
        if (deleteFolderMatch) {
          const name = deleteFolderMatch[1].trim();
          if (!existingFolders.includes(name)) {
            assistantMsg = { id: generateId(), role: "assistant", content: `文件夹「${name}」不存在。` };
          } else {
            deleteFolder(name);
            window.dispatchEvent(new CustomEvent("ai-notes:folder-changed"));
            assistantMsg = { id: generateId(), role: "assistant", content: `✅ 已删除文件夹「${name}」。` };
          }
          setMessages([...newMsgs, assistantMsg!]);
          persistConv([...newMsgs, assistantMsg!], currentId);
          setLoading(false);
          abortRef.current = null;
          return;
        }
        systemPrompt = DELETE_FOLDER_SYSTEM_PROMPT + folderListStr;
      } else if (isDeleteNoteRequest) {
        const deleteNoteMatch = text.match(/(?:删除|移除)\s*(?:笔记|文章)\s*(.+)/);
        if (deleteNoteMatch) {
          const titleHint = deleteNoteMatch[1].trim();
          const notes = getNotes().filter((n) => !n.deletedAt);
          const matched = notes.find((n) => n.title.includes(titleHint));
          if (matched) {
            deleteNote(matched.id);
            assistantMsg = { id: generateId(), role: "assistant", content: `✅ 已删除笔记「${matched.title}」。` };
          } else {
            // 尝试 AI 分析
            const allNotesStr = notes.slice(0, 30).map((n) => `- ID: ${n.id}  标题: ${n.title}  文件夹: ${n.folder || "无"}`).join("\n");
            systemPrompt = DELETE_NOTE_SYSTEM_PROMPT + `\n\n以下是用户所有笔记：\n${allNotesStr}`;
          }
          if (matched) {
            setMessages([...newMsgs, assistantMsg!]);
            persistConv([...newMsgs, assistantMsg!], currentId);
            setLoading(false);
            abortRef.current = null;
            return;
          }
        } else {
          const notes = getNotes().filter((n) => !n.deletedAt);
          const allNotesStr = notes.slice(0, 30).map((n) => `- ID: ${n.id}  标题: ${n.title}  文件夹: ${n.folder || "无"}`).join("\n");
          systemPrompt = DELETE_NOTE_SYSTEM_PROMPT + `\n\n以下是用户所有笔记：\n${allNotesStr}`;
        }
      } else if (isWriteRequest) {
        systemPrompt = WRITE_NOTE_SYSTEM_PROMPT + folderListStr;
      } else if (isOrganizeRequest) {
        const notes = getNotes().filter((n) => !n.folder || (n.tags && n.tags.length === 0));
        if (notes.length === 0) {
          const assistantMsg: Message = { id: generateId(), role: "assistant", content: "没有找到需要整理的笔记。所有笔记都已经有文件夹和标签了。" };
          const finalMsgs = [...newMsgs, assistantMsg];
          setMessages(finalMsgs);
          persistConv(finalMsgs, currentId);
          setLoading(false);
          abortRef.current = null;
          return;
        }
        const noteSummary = notes.slice(0, 50)
          .map((n) => `- ID: ${n.id}\n  标题: ${n.title}\n  当前文件夹: ${n.folder || "无"}\n  当前标签: ${n.tags?.join(", ") || "无"}`)
          .join("\n");
        systemPrompt = ORGANIZE_SYSTEM_PROMPT + folderListStr + `\n\n以下是需要整理的笔记列表：\n${noteSummary}`;
      } else {
        systemPrompt = "你是灵犀笔记助手，一个专注于帮助用户管理笔记和知识的 AI 助手。请回答用户的问题，回答要简洁有帮助。";
      }

      const history = messages
        .filter((m) => m.role === "user" || (m.role === "assistant" && !m.noteData && !m.organizeData))
        .map((m) => ({ role: m.role, content: m.content }));

      const allMessages = [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: text },
      ];

      const content = await chatCompletion(providerInfo.provider, providerInfo.model, allMessages);

      if (abortController.signal.aborted) return;

      if (isWriteRequest) {
        try {
          let jsonStr = content.trim();
          const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
          const start = jsonStr.indexOf("{");
          const end = jsonStr.lastIndexOf("}");
          if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
          const noteData = JSON.parse(jsonStr);
          assistantMsg = {
            id: generateId(), role: "assistant",
            content: `已为你生成笔记「${noteData.title}」，点击下方按钮保存。`,
            noteData: {
              title: noteData.title || "未命名笔记",
              html: noteData.html || "<p></p>",
              folder: noteData.folder || "",
              tags: noteData.tags || [],
            },
          };
        } catch {
          assistantMsg = { id: generateId(), role: "assistant", content };
        }
      } else if (isOrganizeRequest) {
        try {
          let jsonStr = content.trim();
          const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
          const start = jsonStr.indexOf("{");
          const end = jsonStr.lastIndexOf("}");
          if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
          const data = JSON.parse(jsonStr);
          if (data.suggestions && Array.isArray(data.suggestions)) {
            assistantMsg = {
              id: generateId(), role: "assistant",
              content: `找到 ${data.suggestions.length} 篇需要整理的笔记，请确认以下建议：`,
              organizeData: data.suggestions,
            };
          } else {
            assistantMsg = { id: generateId(), role: "assistant", content };
          }
        } catch {
          assistantMsg = { id: generateId(), role: "assistant", content };
        }
      } else if (isCreateFolderRequest) {
        try {
          let jsonStr = content.trim();
          const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
          const start = jsonStr.indexOf("{");
          const end = jsonStr.lastIndexOf("}");
          if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
          const data = JSON.parse(jsonStr);
          if (data.action === "create_folder" && data.name) {
            if (existingFolders.includes(data.name)) {
              assistantMsg = { id: generateId(), role: "assistant", content: `文件夹「${data.name}」已存在，无需重复创建。` };
            } else {
              createFolder(data.name);
              window.dispatchEvent(new CustomEvent("ai-notes:folder-changed"));
              assistantMsg = { id: generateId(), role: "assistant", content: `✅ 已创建文件夹「${data.name}」。` };
            }
          } else {
            assistantMsg = { id: generateId(), role: "assistant", content };
          }
        } catch {
          assistantMsg = { id: generateId(), role: "assistant", content };
        }
      } else if (isRenameFolderRequest) {
        try {
          let jsonStr = content.trim();
          const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
          const start = jsonStr.indexOf("{");
          const end = jsonStr.lastIndexOf("}");
          if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
          const data = JSON.parse(jsonStr);
          if (data.action === "rename_folder" && data.oldName && data.newName) {
            if (!existingFolders.includes(data.oldName)) {
              assistantMsg = { id: generateId(), role: "assistant", content: `文件夹「${data.oldName}」不存在。` };
            } else if (existingFolders.includes(data.newName)) {
              assistantMsg = { id: generateId(), role: "assistant", content: `文件夹「${data.newName}」已存在。` };
            } else {
              renameFolder(data.oldName, data.newName);
              window.dispatchEvent(new CustomEvent("ai-notes:folder-changed"));
              assistantMsg = { id: generateId(), role: "assistant", content: `✅ 已重命名「${data.oldName}」→「${data.newName}」。` };
            }
          } else {
            assistantMsg = { id: generateId(), role: "assistant", content };
          }
        } catch {
          assistantMsg = { id: generateId(), role: "assistant", content };
        }
      } else if (isDeleteFolderRequest) {
        try {
          let jsonStr = content.trim();
          const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
          const start = jsonStr.indexOf("{");
          const end = jsonStr.lastIndexOf("}");
          if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
          const data = JSON.parse(jsonStr);
          if (data.action === "delete_folder" && data.name) {
            if (!existingFolders.includes(data.name)) {
              assistantMsg = { id: generateId(), role: "assistant", content: `文件夹「${data.name}」不存在。` };
            } else {
              deleteFolder(data.name);
              window.dispatchEvent(new CustomEvent("ai-notes:folder-changed"));
              assistantMsg = { id: generateId(), role: "assistant", content: `✅ 已删除文件夹「${data.name}」。` };
            }
          } else {
            assistantMsg = { id: generateId(), role: "assistant", content };
          }
        } catch {
          assistantMsg = { id: generateId(), role: "assistant", content };
        }
      } else if (isDeleteNoteRequest) {
        try {
          let jsonStr = content.trim();
          const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
          const start = jsonStr.indexOf("{");
          const end = jsonStr.lastIndexOf("}");
          if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
          const data = JSON.parse(jsonStr);
          if (data.action === "delete_note" && data.noteId) {
            const note = getNotes().find((n) => n.id === data.noteId);
            if (note && !note.deletedAt) {
              deleteNote(data.noteId);
              assistantMsg = { id: generateId(), role: "assistant", content: `✅ 已删除笔记「${note.title}」。` };
            } else {
              assistantMsg = { id: generateId(), role: "assistant", content: `笔记「${data.noteTitle || data.noteId}」不存在或已被删除。` };
            }
          } else {
            assistantMsg = { id: generateId(), role: "assistant", content };
          }
        } catch {
          assistantMsg = { id: generateId(), role: "assistant", content };
        }
      } else {
        assistantMsg = { id: generateId(), role: "assistant", content };
      }

      const finalMsgs = [...newMsgs, assistantMsg];
      setMessages(finalMsgs);
      persistConv(finalMsgs, currentId);
    } catch (err: any) {
      if (err.name === "AbortError" || abortController.signal.aborted) return;
      const assistantMsg: Message = { id: generateId(), role: "assistant", content: `请求失败：${err.message || "未知错误"}` };
      const finalMsgs = [...newMsgs, assistantMsg];
      setMessages(finalMsgs);
      persistConv(finalMsgs, currentId);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleSaveNote = (noteData: Message["noteData"]) => {
    if (!noteData) return;
    const note = createNote(noteData.title);
    updateNote(note.id, { html: noteData.html, folder: noteData.folder, tags: noteData.tags });
    // 通知侧边栏刷新文件夹列表和笔记列表
    window.dispatchEvent(new CustomEvent("ai-notes:folder-changed"));
    window.dispatchEvent(new CustomEvent("ai-notes:note-changed"));
    const assistantMsg: Message = {
      id: generateId(), role: "assistant",
      content: `✅ 笔记「${noteData.title}」已保存${noteData.folder ? `到 ${noteData.folder}` : ""}，包含 ${noteData.tags.length} 个标签。`,
    };
    const finalMsgs = [...messages, assistantMsg];
    setMessages(finalMsgs);
    persistConv(finalMsgs);
  };

  const handleApplySuggestion = (s: { noteId: string; noteTitle: string; suggestedFolder: string; suggestedTags: string[] }) => {
    updateNote(s.noteId, { folder: s.suggestedFolder, tags: s.suggestedTags });
    window.dispatchEvent(new CustomEvent("ai-notes:folder-changed"));
    const assistantMsg: Message = {
      id: generateId(), role: "assistant",
      content: `✅ 已将「${s.noteTitle}」移至 ${s.suggestedFolder}，标签：${s.suggestedTags.join(", ")}`,
    };
    const finalMsgs = [...messages, assistantMsg];
    setMessages(finalMsgs);
    persistConv(finalMsgs);
  };

  const handleApplyAll = (suggestions: NonNullable<Message["organizeData"]>) => {
    for (const s of suggestions) {
      updateNote(s.noteId, { folder: s.suggestedFolder, tags: s.suggestedTags });
    }
    window.dispatchEvent(new CustomEvent("ai-notes:folder-changed"));
    const assistantMsg: Message = {
      id: generateId(), role: "assistant",
      content: `✅ 已批量整理 ${suggestions.length} 篇笔记，全部归类完成！`,
    };
    const finalMsgs = [...messages, assistantMsg];
    setMessages(finalMsgs);
    persistConv(finalMsgs);
  };

  const handleEditNote = (noteId: string) => router.push(`/edit?id=${noteId}`);

  // ── 消息操作 ─────────────────────────

  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast("已复制");
    } catch {
      // ignore
    }
  };

  const handleDeleteMessage = (msgId: string) => {
    const newMsgs = messages.filter((m) => m.id !== msgId);
    setMessages(newMsgs);
    persistConv(newMsgs);
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditInputValue(msg.content);
  };

  const handleSaveEdit = (msgId: string) => {
    const newMsgs = messages.map((m) =>
      m.id === msgId ? { ...m, content: editInputValue } : m
    );
    setMessages(newMsgs);
    persistConv(newMsgs);
    setEditingMsgId(null);
    setEditInputValue("");
  };

  const handleCancelEdit = () => {
    setEditingMsgId(null);
    setEditInputValue("");
  };

  const quickCommands = [
    { label: "帮我写一篇学习笔记", icon: <Edit size={14} /> },
    { label: "整理笔记", icon: <Sparkles size={14} /> },
    { label: "总结最近的笔记", icon: <FileText size={14} /> },
  ];

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* ── 左侧：对话列表（完全贴边） ── */}
      <div className="flex h-full w-60 shrink-0 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="p-0.5">
          <button
            onClick={handleNewConv}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Plus size={16} />
            新对话
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-0.5 pb-0.5">
          {conversations.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">暂无对话</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => { if (renamingConvId !== conv.id) handleSwitchConv(conv.id); }}
                className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  conv.id === activeConvId
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                <Ai size={14} className="shrink-0" />
                {renamingConvId === conv.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameConv(conv.id);
                      if (e.key === "Escape") setRenamingConvId(null);
                    }}
                    onBlur={() => handleRenameConv(conv.id)}
                    className="min-w-0 flex-1 rounded border border-brand-400 bg-white px-1.5 py-0.5 text-sm text-gray-900 outline-none dark:border-brand-500 dark:bg-gray-800 dark:text-gray-100"
                    autoFocus
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate">{conv.title}</span>
                )}
                <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
                  {formatDate(conv.updatedAt)}
                </span>
                {/* 三点菜单 */}
                <div className="relative shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setConvMenu(convMenu === conv.id ? null : conv.id); }}
                    className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {convMenu === conv.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setConvMenu(null)} />
                      <div className="absolute right-0 z-20 mt-1 min-w-[120px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingConvId(conv.id);
                            setRenameValue(conv.title);
                            setConvMenu(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          <Edit size={14} />
                          修改名称
                        </button>
                        <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                        <button
                          onClick={(e) => { e.stopPropagation(); setConvMenu(null); handleDeleteConv(conv.id); }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 右侧：对话区域 ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <LingxiLogo size={56} collapsed={true} />
              <h2 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">你好，我是灵犀助手</h2>
              <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                我可以帮你写笔记、整理笔记。试试下面的快捷指令，或者直接输入你的需求。
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {quickCommands.map((cmd) => (
                  <button
                    key={cmd.label}
                    onClick={() => { setInput(cmd.label); setTimeout(() => inputRef.current?.focus(), 100); }}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-gray-700 dark:text-gray-400 dark:hover:border-brand-600 dark:hover:bg-brand-900/20"
                  >
                    {cmd.icon}
                    {cmd.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-4">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                const isEditing = editingMsgId === msg.id;
                return (
                  <div key={msg.id} className={`group flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-brand-600 dark:bg-brand-500" : "bg-brand-100 dark:bg-brand-900/30"}`}>
                      {isUser ? (
                        <span className="text-sm font-medium text-white">U</span>
                      ) : (
                        <LingxiLogo size={18} collapsed={true} />
                      )}
                    </div>

                    <div className={`min-w-0 flex-1 ${isUser ? "flex flex-col items-end" : ""}`}>
                      {isEditing ? (
                        <div className="w-full">
                          <textarea
                            className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                            rows={4}
                            value={editInputValue}
                            onChange={(e) => setEditInputValue(e.target.value)}
                          />
                          <div className="mt-1 flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(msg.id)}
                              className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                            >
                              保存
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {isUser ? (
                            <div className="inline-block max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-2.5 text-sm text-white dark:bg-brand-500">
                              {msg.content.split("\n").map((line, i) => (
                                <p key={i}>{line || "\u00A0"}</p>
                              ))}
                            </div>
                          ) : (
                            <>
                              <div className="prose prose-sm max-w-none dark:prose-invert">
                                {msg.content.split("\n").map((line, i) => (
                                  <p key={i} className="text-sm text-gray-700 dark:text-gray-300">{line || "\u00A0"}</p>
                                ))}
                              </div>

                              {msg.noteData && (
                                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                                  <div className="mb-2 flex items-center gap-2">
                                    <FileText size={16} className="text-brand-500" />
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{msg.noteData.title}</span>
                                  </div>
                                  <div className="mb-2 flex flex-wrap gap-2">
                                    {msg.noteData.folder && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                        <Folder size={12} />
                                        {msg.noteData.folder}
                                      </span>
                                    )}
                                    {msg.noteData.tags.map((tag) => (
                                      <span key={tag} className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                                        <Tag size={10} className="mr-0.5" />
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                  <div
                                    className="prose prose-xs max-w-none border-t border-gray-200 pt-2 text-xs text-gray-600 dark:border-gray-700 dark:prose-invert dark:text-gray-400"
                                    dangerouslySetInnerHTML={{ __html: msg.noteData.html }}
                                  />
                                  <div className="mt-3 flex gap-2">
                                    <button
                                      onClick={() => handleSaveNote(msg.noteData)}
                                      className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                                    >
                                      <Save size={14} />
                                      保存为笔记
                                    </button>
                                  </div>
                                </div>
                              )}

                              {msg.organizeData && msg.organizeData.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      共 {msg.organizeData.length} 篇建议
                                    </span>
                                    <button
                                      onClick={() => msg.organizeData && handleApplyAll(msg.organizeData)}
                                      className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                                    >
                                      <Check size={14} />
                                      全部应用
                                    </button>
                                  </div>
                                  {msg.organizeData.map((s) => (
                                    <div key={s.noteId} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                                      <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                          <p className="font-medium text-gray-900 dark:text-gray-100">{s.noteTitle}</p>
                                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                            {s.currentFolder ? `当前：${s.currentFolder}` : "当前：无文件夹"}
                                          </p>
                                        </div>
                                        <div className="ml-2 flex gap-1">
                                          <button onClick={() => handleApplySuggestion(s)} className="rounded p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20" title="应用">
                                            <Check size={16} />
                                          </button>
                                          <button onClick={() => handleEditNote(s.noteId)} className="rounded p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="查看笔记">
                                            <Edit size={16} />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                          <Folder size={10} /> → {s.suggestedFolder}
                                        </span>
                                        {s.suggestedTags.map((tag) => (
                                          <span key={tag} className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                                            +{tag}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          {/* 悬停操作按钮 */}
                          <div className={`mt-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 ${isUser ? "flex-row-reverse" : ""}`}>
                            <button
                              onClick={() => handleCopyMessage(msg.content)}
                              className="rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                              title="复制"
                            >
                              复制
                            </button>
                            <button
                              onClick={() => handleStartEdit(msg)}
                              className="rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                              title="修改"
                            >
                              修改
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
                              title="删除"
                            >
                              删除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30">
                    <LingxiLogo size={18} collapsed={true} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 size={16} className="animate-spin" />
                    思考中...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区 */}
        <div className="border-t border-gray-200 px-4 pt-1.5 pb-0 dark:border-gray-700">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (loading) handleStop();
                    else handleSend();
                  }
                }}
                placeholder="输入你的需求，例如：帮我写一篇关于...的笔记，或者：整理笔记"
                rows={3}
                className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-brand-400"
              />
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={loading ? handleStop : handleSend}
                  disabled={!loading && !input.trim()}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors disabled:opacity-50 ${
                    loading
                      ? "bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
                      : "bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                  }`}
                  title={loading ? "停止生成" : "发送"}
                >
                  {loading ? <Square size={16} /> : <Send size={18} />}
                </button>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  Enter {loading ? "停止" : "发送"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 操作反馈提示 */}
      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900/80 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-sm dark:bg-gray-100/80 dark:text-gray-900">
          {toast}
        </div>
      )}
    </div>
  );
}
