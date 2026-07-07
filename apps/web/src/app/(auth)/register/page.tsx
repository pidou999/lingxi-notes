"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button, Input } from "@ai-notes/ui-kit";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !email || !password) {
      setError("请填写所有字段");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    setLoading(true);
    try {
      await register(username, email, password);
      router.replace("/notes");
    } catch {
      setError("注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="注册" subtitle="创建你的 AI Notes 账号">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div
            className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400"
            role="alert"
          >
            {error}
          </div>
        )}
        <Input
          label="用户名"
          type="text"
          placeholder="你的用户名"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
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
          placeholder="至少 6 位密码"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "注册中..." : "注册"}
        </Button>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          已有账号？{" "}
          <a
            href="/login"
            className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
          >
            登录
          </a>
        </p>
      </form>
    </AuthLayout>
  );
}
