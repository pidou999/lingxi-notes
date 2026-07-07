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
  getStoredUser,
  saveUser,
  clearUser,
  registerUser as storageRegister,
  loginUser as storageLogin,
} from "./storage";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      // Simulate async delay for realism
      await new Promise((r) => setTimeout(r, 300));
      const u = storageLogin(email, password);
      if (!u) throw new Error("登录失败");
      setUser(u);
      return u;
    },
    []
  );

  const register = useCallback(
    async (
      username: string,
      email: string,
      password: string
    ): Promise<User> => {
      await new Promise((r) => setTimeout(r, 300));
      const u = storageRegister(username, email, password);
      setUser(u);
      return u;
    },
    []
  );

  const logout = useCallback(() => {
    clearUser();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Redirect to /login if not authenticated */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.replace("/login");
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  return auth;
}
