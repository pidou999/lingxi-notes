"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "./types";
import {
  getStoredUser as storageGetUser,
  saveUser as storageSaveUser,
  clearUser as storageClearUser,
} from "./storage";
import { apiLogin, apiRegister, isLoggedIn, loadToken, setToken, clearToken } from "./api";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 从加密存储加载 token（异步）
    loadToken().then(() => {
      // 优先从 localStorage 恢复用户信息（兼容旧离线模式）
      const stored = storageGetUser();
      if (stored) {
        setUser(stored);
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<User> => {
    try {
      const result = await apiLogin(username, password);
      const u: User = { id: result.user.id, username: result.user.username, email: (result.user as { email?: string }).email || "" };
      setToken(result.token);
      storageSaveUser(u);
      setUser(u);
      return u;
    } catch (err) {
      // 后端不可用：回退到本地账户，但明确告知用户后端状态
      const { loginUser } = await import("./storage");
      const u = await loginUser(username, password);
      if (!u) throw new Error("登录失败（后端离线，本地也无此账户）");
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.warn("后端不可用，已使用本地账户登录：", (err as Error)?.message || err);
        window.dispatchEvent(new CustomEvent("ai-notes:backend-offline", { detail: { action: "login" } }));
      }
      setUser(u);
      return u;
    }
  }, []);

  const register = useCallback(async (username: string, email: string, password: string): Promise<User> => {
    try {
      const result = await apiRegister(username, password);
      const u: User = { id: result.user.id, username: result.user.username, email: (result.user as { email?: string }).email || email };
      setToken(result.token);
      storageSaveUser(u);
      setUser(u);
      return u;
    } catch (err) {
      const { registerUser } = await import("./storage");
      const u = await registerUser(username, email, password);
      if (!u) throw new Error("注册失败（后端离线，本地也未创建账户）");
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.warn("后端不可用，已在本地创建账户：", (err as Error)?.message || err);
        window.dispatchEvent(new CustomEvent("ai-notes:backend-offline", { detail: { action: "register" } }));
      }
      setUser(u);
      return u;
    }
  }, []);

  const logout: () => Promise<void> = useCallback(async () => {
    await clearToken();
    storageClearUser();
    localStorage.removeItem("ai-notes:skip-auth");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** 未登录时重定向到 /login */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !hasSkippedAuth()) {
      router.replace("/login");
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  return auth;
}

/** 跳过认证标记 */
const SKIP_KEY = "ai-notes:skip-auth";

export function hasSkippedAuth(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SKIP_KEY) === "true";
}

export function skipAuth(): void {
  localStorage.setItem(SKIP_KEY, "true");
}
