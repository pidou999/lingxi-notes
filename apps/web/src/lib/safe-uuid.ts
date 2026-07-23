/**
 * 安全的 UUID 生成器
 * 浏览器 HTTP 环境下 crypto.randomUUID() 会抛 SecurityError
 */
export function safeUUID(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
}
