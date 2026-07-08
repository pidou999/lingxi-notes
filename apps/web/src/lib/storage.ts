import type { Note, User } from "./types";
import {
  isLoggedIn,
  apiCreateNote,
  apiUpdateNote,
  apiDeleteNote,
} from "./api";

const STORAGE_PREFIX = "ai-notes:";

function get<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function set<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
}

// ─── API 同步辅助 ────────────────────────────
// 登录时自动将本地操作同步到后端，静默失败（离线/后端未启动都不影响）

function syncCreateToApi(note: Note): void {
  if (!isLoggedIn()) return;
  apiCreateNote({
    id: note.id,
    title: note.title,
    html: note.html,
    json: JSON.stringify(note.json || {}),
    tags: JSON.stringify(note.tags || []),
  }).catch(() => {
    /* 静默：后端不可达时只存本地 */
  });
}

function syncUpdateToApi(id: string, data: Partial<Pick<Note, "title" | "html" | "json" | "tags">>): void {
  if (!isLoggedIn()) return;
  apiUpdateNote(id, {
    title: data.title,
    html: data.html,
    json: data.json ? JSON.stringify(data.json) : undefined,
    tags: data.tags ? JSON.stringify(data.tags) : undefined,
  }).catch(() => {});
}

function syncDeleteToApi(id: string): void {
  if (!isLoggedIn()) return;
  apiDeleteNote(id).catch(() => {});
}

// ─── Users / Auth ───────────────────────────────────

export function getStoredUser(): User | null {
  return get<User | null>("user", null);
}

export function saveUser(user: User): void {
  set("user", user);
}

export function clearUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_PREFIX + "user");
}

export function registerUser(
  username: string,
  email: string,
  _password: string
): User {
  const user: User = {
    id: crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    username,
    email,
  };
  saveUser(user);
  return user;
}

export function loginUser(email: string, _password: string): User | null {
  const existing = getStoredUser();
  if (existing && existing.email === email) {
    return existing;
  }
  const username = email.split("@")[0];
  return registerUser(username, email, _password);
}

// ─── Notes ──────────────────────────────────────────

export function getNotes(): Note[] {
  return get<Note[]>("notes", [])
    .filter((n) => !n.deletedAt)
    .sort((a, b) => {
      // 置顶优先
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // 然后按更新时间倒序
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}

export function saveNotes(notes: Note[]): void {
  set("notes", notes);
}

export function getNote(id: string): Note | undefined {
  return get<Note[]>("notes", []).find((n) => n.id === id);
}

export function createNote(title: string): Note {
  const now = new Date().toISOString();
  const note: Note = {
    id: crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    title: title || "",
    html: "",
    json: {},
    createdAt: now,
    updatedAt: now,
  };
  const notes = get<Note[]>("notes", []);
  notes.unshift(note);
  saveNotes(notes);
  syncCreateToApi(note);
  return note;
}

export function updateNote(
  id: string,
  data: Partial<Pick<Note, "title" | "html" | "json" | "tags" | "pinned" | "starred" | "password" | "folder">>
): Note | undefined {
  const notes = get<Note[]>("notes", []);
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return undefined;
  notes[idx] = {
    ...notes[idx],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  saveNotes(notes);
  syncUpdateToApi(id, data);
  return notes[idx];
}

export function deleteNote(id: string): void {
  const notes = get<Note[]>("notes", []);
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return;
  notes[idx] = {
    ...notes[idx],
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveNotes(notes);
  syncUpdateToApi(id, {}); // 后端负责软删除
}

// ─── Trash ──────────────────────────────────────────

export function getTrashNotes(): Note[] {
  return get<Note[]>("notes", []).filter((n) => n.deletedAt);
}

export function restoreNote(id: string): Note | undefined {
  const notes = get<Note[]>("notes", []);
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return undefined;
  notes[idx] = {
    ...notes[idx],
    deletedAt: undefined,
    updatedAt: new Date().toISOString(),
  };
  saveNotes(notes);
  syncUpdateToApi(id, {});
  return notes[idx];
}

export function permanentDeleteNote(id: string): void {
  const notes = get<Note[]>("notes", []).filter((n) => n.id !== id);
  saveNotes(notes);
  syncDeleteToApi(id);
}

// ─── Folders ──────────────────────────────────────────

const FOLDERS_KEY = "folders";

/** 获取手动保存的文件夹列表（独立于笔记） */
function getSavedFolders(): string[] {
  return get<string[]>(FOLDERS_KEY, []);
}

function setSavedFolders(list: string[]): void {
  set(FOLDERS_KEY, list);
}

/** 将所有文件夹合并返回（手动保存的 + 笔记中存在的） */
export function getFolders(): string[] {
  const notes = get<Note[]>("notes", []).filter((n) => !n.deletedAt);
  const folders = new Set<string>();
  // 从笔记中收集
  for (const n of notes) {
    if (n.folder) folders.add(n.folder);
  }
  // 合并手动保存的
  for (const f of getSavedFolders()) {
    folders.add(f);
  }
  return Array.from(folders).sort();
}

/** 创建文件夹（不创建笔记） */
export function createFolder(name: string): void {
  if (!name) return;
  const list = getSavedFolders();
  if (!list.includes(name)) {
    list.push(name);
    setSavedFolders(list);
  }
}

/** 重命名文件夹（更新笔记 + 手动列表） */
export function renameFolder(oldName: string, newName: string): void {
  if (!oldName || !newName || oldName === newName) return;
  // 更新笔记
  const notes = get<Note[]>("notes", []);
  let changed = false;
  for (const note of notes) {
    if (note.folder === oldName) {
      note.folder = newName;
      note.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) saveNotes(notes);
  // 更新手动列表
  const saved = getSavedFolders();
  const idx = saved.indexOf(oldName);
  if (idx !== -1) {
    saved[idx] = newName;
    setSavedFolders(saved);
  }
}

/** 删除文件夹（清除笔记中的 + 手动列表） */
export function deleteFolder(name: string): void {
  if (!name) return;
  // 清除笔记
  const notes = get<Note[]>("notes", []);
  let changed = false;
  for (const note of notes) {
    if (note.folder === name) {
      note.folder = undefined;
      note.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) saveNotes(notes);
  // 从手动列表中移除
  const saved = getSavedFolders().filter((f) => f !== name);
  setSavedFolders(saved);
}

export function getNotesByFolder(folder: string): Note[] {
  return getNotes().filter((n) => n.folder === folder);
}

export function getStarredNotes(): Note[] {
  return getNotes().filter((n) => n.starred);
}

export function togglePinned(id: string): Note | undefined {
  const note = getNote(id);
  if (!note) return undefined;
  return updateNote(id, { pinned: !note.pinned });
}

export function toggleStarred(id: string): Note | undefined {
  const note = getNote(id);
  if (!note) return undefined;
  return updateNote(id, { starred: !note.starred });
}

// ─── Tags ──────────────────────────────────────────

export interface TagWithCount {
  name: string;
  count: number;
}

/** 获取所有标签及其笔记数量 */
export function getAllTags(): TagWithCount[] {
  const notes = getNotes();
  const map = new Map<string, number>();
  for (const n of notes) {
    if (n.tags && Array.isArray(n.tags)) {
      for (const t of n.tags) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** 获取包含指定标签的笔记 */
export function getNotesByTag(tag: string): Note[] {
  return getNotes().filter((n) => n.tags && n.tags.includes(tag));
}
