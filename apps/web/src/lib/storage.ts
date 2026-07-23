import type { Note, User } from "./types";
import {
  isLoggedIn,
  apiCreateNote,
  apiUpdateNote,
  apiDeleteNote,
  apiRestoreNote,
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
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // 隐私模式 / Safari 配额满 / 存储被禁用时静默失败，不阻塞调用方
  }
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

export async function hashPassword(password: string): Promise<string> {
  return sha256Hex(password);
}

/** SHA-256 哈希（同步包装，供非 async 上下文使用） */
export function sha256Hex(password: string): string {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    // crypto.subtle.digest 是异步的，这里用同步降级实现保证可用性
    return syncSha256(data);
  } catch {
    // 极旧环境回退到不安全的简单哈希（仅本地锁屏，非密码存储）
    return "fallback:" + password;
  }
}

// 轻量同步 SHA-256 实现（FIPS 180-4），避免依赖异步 crypto.subtle 的调用复杂性
function syncSha256(bytes: Uint8Array): string {
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const block = new Uint32Array(64);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);

  const msg: number[] = Array.from(bytes);
  const bitLen = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  // 64 位大端长度
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  msg.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff, (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < msg.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      block[i] = (msg[off + i * 4] << 24) | (msg[off + i * 4 + 1] << 16) | (msg[off + i * 4 + 2] << 8) | msg[off + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(block[i - 15], 7) ^ rotr(block[i - 15], 18) ^ (block[i - 15] >>> 3);
      const s1 = rotr(block[i - 2], 17) ^ rotr(block[i - 2], 19) ^ (block[i - 2] >>> 10);
      block[i] = (block[i - 16] + s0 + block[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + k[i] + block[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  return Array.from(h)
    .map((x) => (x >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

/**
 * 校验笔记密码：优先比对 SHA-256 哈希；兼容旧版明文存储（迁移期）。
 * 返回 true 表示密码正确。
 */
export function verifyNotePassword(input: string, stored?: string): boolean {
  if (!stored) return false;
  if (sha256Hex(input) === stored) return true;
  // 迁移兼容：旧数据可能是明文
  return input === stored;
}

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<User> {
  const passwordHash = password ? await hashPassword(password) : undefined;
  const user: User = {
    id: crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    username,
    email,
    passwordHash,
  };
  saveUser(user);
  return user;
}

export async function loginUser(username: string, password: string): Promise<User | null> {
  const existing = getStoredUser();
  if (!existing) return null;
  if (existing.username !== username && existing.email !== username) {
    return null;
  }
  if (!existing.passwordHash || !password) {
    return null;
  }
  const inputHash = await hashPassword(password);
  if (inputHash !== existing.passwordHash) {
    return null;
  }
  return existing;
}

// ─── Notes ──────────────────────────────────────────

// 内存缓存：避免多页面高频 getNotes() 反复 JSON.parse + 排序。
// 以 localStorage 原始字符串为 key，写入时 raw 变化自动失效；SSR 下不缓存。
let _notesCache: Note[] | null = null;
let _notesRawRef: string | null = null;

// 跨标签页缓存失效：另一个标签页修改 notes 时，本标签页缓存置空。
// storage 事件只在「其他标签页」触发，故此处重置是安全的。
let _storageListenerAttached = false;
if (typeof window !== "undefined" && !_storageListenerAttached) {
  _storageListenerAttached = true;
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_PREFIX + "notes") {
      _notesCache = null;
      _notesRawRef = null;
    }
  });
}

export function getNotes(): Note[] {
  const raw =
    typeof window === "undefined"
      ? null
      : localStorage.getItem(STORAGE_PREFIX + "notes");
  if (raw !== _notesRawRef || !_notesCache) {
    _notesRawRef = raw;
    _notesCache = (raw ? (JSON.parse(raw) as Note[]) : [])
      .filter((n) => !n.deletedAt)
      .sort((a, b) => {
        // 置顶优先
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // 然后按更新时间倒序
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }
  // 返回每个 note 的浅拷贝，避免调用方修改对象字段污染缓存
  return _notesCache.map((n) => ({ ...n }));
}

export function saveNotes(notes: Note[]): void {
  set("notes", notes);
}

export function getNote(id: string): Note | undefined {
  const raw =
    typeof window === "undefined"
      ? null
      : localStorage.getItem(STORAGE_PREFIX + "notes");
  // 优先读缓存（与 getNotes 保持一致），始终返回浅拷贝以避免污染缓存
  if (raw === _notesRawRef && _notesCache) {
    const found = _notesCache.find((n) => n.id === id);
    return found ? { ...found } : undefined;
  }
  const found = (raw ? (JSON.parse(raw) as Note[]) : []).find((n) => n.id === id);
  return found ? { ...found } : undefined;
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
  syncDeleteToApi(id);
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
  if (isLoggedIn()) {
    apiRestoreNote(id).catch(() => {});
  }
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

/**
 * 清理孤儿文件夹路径 + 补全父级路径。
 * 如果笔记的 folder 根路径不在已知文件夹中，自动补全所有父级。
 * 例如：savedFolders = [], 笔记 folder = 软件工具/压缩解压
 * → 自动添加 软件工具、软件工具/压缩解压 到 savedFolders
 */
function cleanOrphanFolders(): void {
  const saved = getSavedFolders();
  const notes = get<Note[]>("notes", []);
  let notesChanged = false;
  let savedChanged = false;
  const newSaved = new Set(saved);

  for (const note of notes) {
    if (!note.folder) continue;
    const folder = note.folder;
    // 直接匹配 — 有效
    if (newSaved.has(folder)) continue;
    // 前缀匹配 — 有父文件夹存在，有效
    if ([...newSaved].some((s) => folder.startsWith(s + "/"))) continue;
    // 孤儿路径 — 补全所有父级路径
    const parts = folder.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const partial = parts.slice(0, i).join("/");
      if (!newSaved.has(partial)) {
        newSaved.add(partial);
        savedChanged = true;
      }
    }
  }
  if (notesChanged) saveNotes(notes);
  if (savedChanged) setSavedFolders(Array.from(newSaved));
}

/** 将所有文件夹合并返回（手动保存的 + 笔记中存在的 + 自动补全父级） */
export function getFolders(): string[] {
  cleanOrphanFolders();
  const notes = get<Note[]>("notes", []).filter((n) => !n.deletedAt);
  const folders = new Set<string>();
  // 从笔记中收集（包括所有父级路径）
  for (const n of notes) {
    if (!n.folder) continue;
    const parts = n.folder.split("/");
    for (let i = 1; i <= parts.length; i++) {
      folders.add(parts.slice(0, i).join("/"));
    }
  }
  // 合并手动保存的（也展开父级路径）
  for (const f of getSavedFolders()) {
    const parts = f.split("/");
    for (let i = 1; i <= parts.length; i++) {
      folders.add(parts.slice(0, i).join("/"));
    }
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

/** 重命名文件夹（仅改该文件夹本身，不影响子文件夹） */
export function renameFolder(oldName: string, newName: string): void {
  if (!oldName || !newName || oldName === newName) return;
  // 只改精确匹配的笔记
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
  // 更新手动列表（只改精确匹配的文件夹名）
  const saved = getSavedFolders().map((f) => (f === oldName ? newName : f));
  setSavedFolders(saved);
}

/** 移动文件夹到目标父文件夹下（重命名 + 更新子文件夹和笔记路径） */
export function moveFolder(source: string, targetParent: string): void {
  if (!source || source === targetParent) return;
  // 不能移动到自己的子文件夹
  if (targetParent && targetParent.startsWith(source + "/")) return;
  const baseName = source.split("/").pop()!;
  const newFullName = targetParent ? targetParent + "/" + baseName : baseName;
  // 1. 更新笔记路径
  const notes = get<Note[]>("notes", []);
  let notesChanged = false;
  for (const note of notes) {
    if (note.folder === source) {
      note.folder = newFullName;
      note.updatedAt = new Date().toISOString();
      notesChanged = true;
    } else if (note.folder && note.folder.startsWith(source + "/")) {
      note.folder = newFullName + note.folder.slice(source.length);
      note.updatedAt = new Date().toISOString();
      notesChanged = true;
    }
  }
  if (notesChanged) saveNotes(notes);
  // 2. 更新保存的文件夹列表
  const saved = getSavedFolders();
  const newSaved: string[] = [];
  for (const f of saved) {
    if (f === source) {
      if (!newSaved.includes(newFullName)) newSaved.push(newFullName);
    } else if (f.startsWith(source + "/")) {
      const updated = newFullName + f.slice(source.length);
      if (!newSaved.includes(updated)) newSaved.push(updated);
    } else {
      newSaved.push(f);
    }
  }
  // 确保目标父文件夹在列表中
  if (!newSaved.includes(targetParent)) newSaved.push(targetParent);
  setSavedFolders(newSaved);
}

/** 删除文件夹（子文件夹提升为根，笔记路径同步更新，直接笔记变未分类） */
export function deleteFolder(name: string): void {
  if (!name) return;
  const prefix = name + "/";
  // 1. 更新笔记：直接笔记变未分类，子文件夹笔记路径更新
  const notes = get<Note[]>("notes", []);
  let notesChanged = false;
  for (const note of notes) {
    if (note.folder === name) {
      // 直接笔记 → 未分类
      note.folder = undefined;
      note.updatedAt = new Date().toISOString();
      notesChanged = true;
    } else if (note.folder && note.folder.startsWith(prefix)) {
      // 子文件夹笔记 → 去掉已删除层级
      note.folder = note.folder.slice(prefix.length);
      note.updatedAt = new Date().toISOString();
      notesChanged = true;
    }
  }
  if (notesChanged) saveNotes(notes);
  // 2. 更新文件夹列表：移除自身，子文件夹路径更新
  const saved = getSavedFolders();
  const newSaved: string[] = [];
  for (const f of saved) {
    if (f === name) continue;
    if (f.startsWith(prefix)) {
      const updated = f.slice(prefix.length);
      if (!newSaved.includes(updated)) newSaved.push(updated);
    } else {
      newSaved.push(f);
    }
  }
  setSavedFolders(newSaved);
}

export function getNotesByFolder(folder: string): Note[] {
  return getNotes().filter((n) => n.folder === folder || (n.folder && n.folder.startsWith(folder + "/")));
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
