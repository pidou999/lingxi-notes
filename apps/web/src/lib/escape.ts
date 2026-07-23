/**
 * HTML 转义工具：集中管理，避免在各组件中重复内联实现。
 */

/** 转义字符串中的特殊字符为 HTML 实体，防止 HTML/属性注入。 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 用于 HTML 属性的转义。属性值应使用与 escapeHtml 相同的实体转义，
 * 这里直接复用 escapeHtml（行为与内联实现保持一致）。
 */
export function escapeAttr(s: string): string {
  return escapeHtml(s);
}
