"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@ai-notes/ui-kit";
import { Close } from "@ai-notes/icons";
import { updateNote, getNote, hashPassword, verifyNotePassword } from "@/lib/storage";
import type { Note } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  noteId: string;
  /** 已存储的密码（明文或哈希），用于修改/清除时校验 */
  currentPassword?: string;
  /** 设置成功回调 */
  onSaved?: () => void;
  /**
   * 仅解锁模式：不修改密码，仅校验输入是否正确。
   * 成功后调用 onUnlock 而非 onSaved。
   */
  unlockOnly?: boolean;
  onUnlock?: () => void;
}

export function PasswordDialog({ open, onClose, noteId, currentPassword, onSaved, unlockOnly, onUnlock }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"set" | "unlock" | "verify">("set");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setConfirmPassword("");
      setError("");
      setStep("set");
      return;
    }
    const note = getNote(noteId);
    if (note?.password) {
      setStep("unlock");
    } else {
      setStep("set");
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, noteId]);

  const handleSetPassword = useCallback(async () => {
    setError("");
    // 修改模式下，先校验当前密码
    if (step === "unlock" && currentPassword) {
      if (!verifyNotePassword(password, currentPassword)) {
        setError("当前密码错误");
        return;
      }
    }
    if (!password) {
      // 清除密码
      updateNote(noteId, { password: undefined });
      onSaved?.();
      onClose();
      return;
    }
    if (password.length < 3) {
      setError("密码至少 3 个字符");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次密码不一致");
      return;
    }
    // 存储 SHA-256 哈希，绝不存明文
    const hashed = await hashPassword(password);
    updateNote(noteId, { password: hashed });
    onSaved?.();
    onClose();
  }, [step, currentPassword, password, confirmPassword, noteId, onSaved, onClose]);

  const handleRemovePassword = useCallback(() => {
    if (!confirm("确定清除密码？")) return;
    updateNote(noteId, { password: undefined });
    onSaved?.();
    onClose();
  }, [noteId, onSaved, onClose]);

  const handleUnlock = useCallback(async () => {
    setError("");
    if (verifyNotePassword(password, currentPassword)) {
      onUnlock?.();
      onClose();
    } else {
      setError("密码错误");
      setPassword("");
    }
  }, [password, currentPassword, onUnlock, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {unlockOnly ? "输入密码" : currentPassword ? "修改密码" : "设置密码"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Close size={20} />
          </button>
        </div>

        <div className="p-5">
          {unlockOnly ? (
            <>
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                此笔记已加密，请输入密码查看内容
              </p>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                onKeyDown={(e) => e.key === "Enter" && void handleUnlock()}
              />
              {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
                <Button size="sm" onClick={() => void handleUnlock()}>解锁</Button>
              </div>
            </>
          ) : step === "unlock" && currentPassword ? (
            <>
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                当前已设置密码，输入当前密码可修改或清除
              </p>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入当前密码"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                onKeyDown={(e) => e.key === "Enter" && void handleSetPassword()}
              />
              {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={handleRemovePassword}
                  className="text-sm text-red-500 hover:text-red-600"
                >
                  清除密码
                </button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
                  <Button size="sm" onClick={() => void handleSetPassword()}>验证</Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                {currentPassword ? "修改密码" : "为此笔记设置密码，打开时需要输入"}
              </p>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                onKeyDown={(e) => e.key === "Enter" && void handleSetPassword()}
              />
              {password && (
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="确认密码"
                  className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  onKeyDown={(e) => e.key === "Enter" && void handleSetPassword()}
                />
              )}
              {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
              <div className="flex items-center justify-end gap-2">
                {currentPassword && (
                  <Button variant="ghost" size="sm" onClick={handleRemovePassword}>
                    清除
                  </Button>
                )}
                <Button size="sm" onClick={() => void handleSetPassword()}>
                  {password ? (currentPassword ? "修改" : "设置") : "清除"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
