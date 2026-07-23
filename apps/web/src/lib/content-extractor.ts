/**
 * content-extractor — 统一内容提取器
 *
 * 这是同目录模块化拆分的转发入口。
 * 核心实现在 content-extractor/index.ts。
 *
 * 拆分后外部 import 路径不变，保持兼容：
 * ```ts
 * import { extractContent, ExtractResult, ... } from '@/lib/content-extractor';
 * ```
 */
export * from './content-extractor/index';
