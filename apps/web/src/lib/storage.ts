import type { Note, User } from "./types";

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
  // Simple demo: create/return user based on email
  // In real app: validate against stored credentials
  const existing = getStoredUser();
  if (existing && existing.email === email) {
    return existing;
  }
  // First-time login: create from email
  const username = email.split("@")[0];
  return registerUser(username, email, _password);
}

// ─── Notes ──────────────────────────────────────────

export function getNotes(): Note[] {
  return get<Note[]>("notes", []);
}

export function saveNotes(notes: Note[]): void {
  set("notes", notes);
}

export function getNote(id: string): Note | undefined {
  return getNotes().find((n) => n.id === id);
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
  const notes = getNotes();
  notes.unshift(note);
  saveNotes(notes);
  return note;
}

export function updateNote(
  id: string,
  data: Partial<Pick<Note, "title" | "html" | "json">>
): Note | undefined {
  const notes = getNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return undefined;
  notes[idx] = {
    ...notes[idx],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  saveNotes(notes);
  return notes[idx];
}

export function deleteNote(id: string): void {
  const notes = getNotes().filter((n) => n.id !== id);
  saveNotes(notes);
}
