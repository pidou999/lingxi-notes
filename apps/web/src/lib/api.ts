/**
 * API 客户端 — 封装对 Go 后端的 HTTP 调用
 * 通过 Next.js rewrites 同源代理，不走跨域
 *
 * Token 存储：使用 Web Crypto AES-GCM 加密后存 localStorage，
 * 应用启动时异步解密到内存缓存。
 */

import { secureSet, secureGet, secureRemove } from "./secure-storage";

const API_BASE = "";
const TOKEN_KEY = "auth:token";

// ====== 内存 Token 缓存 ======
let _token: string | null = null;
let _loaded = false;

/** 应用启动时调用：从加密存储加载 token 到内存 */
export async function loadToken(): Promise<void> {
  if (_loaded) return;
  _token = await secureGet(TOKEN_KEY);
  _loaded = true;
}

/** 同步读取 token（request 拦截器用） */
function getToken(): string | null {
  if (!_loaded) {
    // fallback：还没加载完就尝试同步读（兼容旧明文）
    if (typeof window === "undefined") return null;
    try {
      const plain = localStorage.getItem("ai-notes:token");
      if (plain) return plain;
    } catch {
      // ignore
    }
  }
  return _token;
}

export async function setToken(token: string): Promise<void> {
  _token = token;
  await secureSet(TOKEN_KEY, token);
  // 清理旧明文 key
  try { localStorage.removeItem("ai-notes:token"); } catch { /* ignore */ }
}

export async function clearToken(): Promise<void> {
  _token = null;
  await secureRemove(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// 请求超时（毫秒）。局域网部署下避免挂起导致 UI 卡死。
const REQUEST_TIMEOUT = 15_000;

// 简单指数退避重试（仅对幂等的 GET 使用）
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries: number
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries && err instanceof DOMException && err.name === "AbortError") {
        // 超时：等待后重试（指数退避）
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const init: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  // GET 类请求启用超时 + 指数退避重试；写请求只加超时
  const res = await fetchWithRetry(
    `${API_BASE}${path}`,
    init,
    method.toUpperCase() === "GET" ? 2 : 0
  );

  if (res.status === 401) {
    await clearToken();
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

// ─── Trash ────────────────────────────────────────

export interface TrashNoteData extends NoteData {
  deletedAt: string;
}

export function apiListTrash() {
  return request<TrashNoteData[]>("GET", "/api/v1/trash");
}

export function apiRestoreNote(id: string) {
  return request<{ status: string }>("POST", `/api/v1/trash/${id}/restore`);
}

export function apiPermanentDelete(id: string) {
  return request<{ status: string }>("DELETE", `/api/v1/trash/${id}`);
}

export function apiCleanTrash() {
  return request<{ status: string; deleted: number }>("POST", "/api/v1/trash/clean");
}

export function apiRestoreAllTrash() {
  return request<{ status: string; restored: number }>("POST", "/api/v1/trash/restore-all");
}

export function apiEmptyTrash() {
  return request<{ status: string; deleted: number }>("POST", "/api/v1/trash/empty");
}
