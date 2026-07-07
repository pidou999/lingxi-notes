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
import { apiLogin, apiRegister, isLoggedIn, setToken, clearToken } from "./api";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (username: string, email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 优先从 localStorage 恢复用户信息（兼容旧离线模式）
    const stored = storageGetUser();
    if (stored) {
      setUser(stored);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    // 尝试 API 登录
    try {
      const result = await apiLogin(email, password);
      const u: User = { id: result.user.id, username: result.user.username, email };
      setToken(result.token);
      storageSaveUser(u);
      setUser(u);
      return u;
    } catch {
      // API 不可用时，回退到本地
      const { loginUser } = await import("./storage");
      const u = loginUser(email, password);
      if (!u) throw new Error("登录失败（后端离线，本地也无此账户）");
      setUser(u);
      return u;
    }
  }, []);

  const register = useCallback(async (username: string, email: string, password: string): Promise<User> => {
    try {
      const result = await apiRegister(username, password);
      const u: User = { id: result.user.id, username: result.user.username, email };
      setToken(result.token);
      storageSaveUser(u);
      setUser(u);
      return u;
    } catch {
      // API 不可用时，回退到本地注册
      const { registerUser } = await import("./storage");
      const u = registerUser(username, email, password);
      if (!u) throw new Error("注册失败");
      setUser(u);
      return u;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
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
