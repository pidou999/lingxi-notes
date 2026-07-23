/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TipTap 编辑器类型安全包装
 * 
 * 解决 @tiptap/core 版本不一致导致 ChainedCommands 类型缺失的问题。
 * 使用 `any` 类型断言绕过类型检查，运行时完全正常。
 */
import type { Editor } from "@tiptap/react";

/** 类型安全的 editor.chain() 调用 */
export function chain(editor: Editor) {
  return editor.chain().focus() as any;
}

/** 类型安全的 editor.commands 调用 */
export function cmds(editor: Editor) {
  return editor.commands as any;
}
