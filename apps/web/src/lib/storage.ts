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
  return get<Note[]>("notes", []).filter((n) => !n.deletedAt);
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
  data: Partial<Pick<Note, "title" | "html" | "json" | "tags">>
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
