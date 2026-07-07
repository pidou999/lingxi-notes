"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button, Input } from "@ai-notes/ui-kit";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("请填写邮箱和密码");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/notes");
    } catch {
      setError("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="登录" subtitle="欢迎回到 AI Notes">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400" role="alert">
            {error}
          </div>
        )}
        <Input
          label="邮箱"
          type="email"
          placeholder="your@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="密码"
          type="password"
          placeholder="输入密码"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "登录中..." : "登录"}
        </Button>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          还没有账号？{" "}
          <a
            href="/register"
            className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
          >
            注册
          </a>
        </p>
      </form>
    </AuthLayout>
  );
}
