// API 客户端 — 封装对 Go 后端的 HTTP 调用
// 通过 Next.js rewrites 同源代理，不走跨域

const API_BASE = "";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ai-notes:token");
}

export function setToken(token: string): void {
  localStorage.setItem("ai-notes:token", token);
}

export function clearToken(): void {
  localStorage.removeItem("ai-notes:token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("auth:logout"));
    throw new Error("登录已过期，请重新登录");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `请求失败: ${res.status}`);
  }

  return res.json();
}

// ─── Auth ───────────────────────────────────────

export interface AuthResult {
  token: string;
  user: { id: string; username: string };
}

export function apiRegister(username: string, password: string) {
  return request<AuthResult>("POST", "/api/v1/auth/register", { username, password });
}

export function apiLogin(username: string, password: string) {
  return request<AuthResult>("POST", "/api/v1/auth/login", { username, password });
}

// ─── Notes ──────────────────────────────────────

export interface NoteData {
  id: string;
  title: string;
  html: string;
  json: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

export function apiListNotes() {
  return request<NoteData[]>("GET", "/api/v1/notes");
}

export function apiCreateNote(data: { id?: string; title?: string; html?: string; json?: string; tags?: string }) {
  return request<NoteData>("POST", "/api/v1/notes", data);
}

export function apiGetNote(id: string) {
  return request<NoteData>("GET", `/api/v1/notes/${id}`);
}

export function apiUpdateNote(id: string, data: { title?: string; html?: string; json?: string; tags?: string }) {
  return request<{ status: string }>("PUT", `/api/v1/notes/${id}`, data);
}

export function apiDeleteNote(id: string) {
  return request<{ status: string }>("DELETE", `/api/v1/notes/${id}`);
}

// ─── Providers ──────────────────────────────────

export interface ProviderData {
  id: string;
  type: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  protocol: string;
  models: string;
}

export function apiListProviders() {
  return request<ProviderData[]>("GET", "/api/v1/providers");
}

export function apiCreateProvider(data: Omit<ProviderData, "id">) {
  return request<ProviderData>("POST", "/api/v1/providers", data);
}

export function apiUpdateProvider(id: string, data: Partial<ProviderData>) {
  return request<{ status: string }>("PUT", `/api/v1/providers/${id}`, data);
}

export function apiDeleteProvider(id: string) {
  return request<{ status: string }>("DELETE", `/api/v1/providers/${id}`);
}

// ─── Tags ────────────────────────────────────────

export interface TagData {
  name: string;
  count: number;
}

export function apiListTags() {
  return request<TagData[]>("GET", "/api/v1/tags");
}

export function apiListNotesByTag(tag: string) {
  return request<NoteData[]>("GET", `/api/v1/tags/${encodeURIComponent(tag)}`);
}

// ─── Search ──────────────────────────────────────

export function apiSearch(q: string) {
  return request<NoteData[]>("GET", `/api/v1/search?q=${encodeURIComponent(q)}`);
}
