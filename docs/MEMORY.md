# MEMORY.md — ai-notes 项目记忆

> 最后更新：2026-07-17

## 项目基础
- **路径**：`D:\开发项目\ai-notes`
- **端口**：8877（固定）
- **构建模式**：Webpack（禁用 Turbopack）
- **体积**：约 500MB（不含 node_modules），从 1126MB 缩减
- **备份**：`D:\开发项目\ai-notes-backup-20260712.zip`（87MB）

## 核心功能
- TopBarSearch 双模式搜索：关键词搜索 + AI 语义搜索 + 联网混合模式
- 搜索结果以 ResultModal 弹窗阅读，支持保存为笔记
- DOCX 导出、ChatPanel 交互修复
- 剪藏服务 (`/api/clip/fetch`)
- Embedding 模型自动探测与降级策略

## 搜索引擎
- 三引擎并行：Bing + 百度 + DuckDdGo，优先 Bing+百度
- 搜索结果过滤：移除 GitHub、官方文档、首页等
- 标题从 `<h2><a>` 提取

## 内容抓取
- Playwright + 用户 Cookie 方案（知乎专用）
- 浏览器启动参数含 `--disable-blink-features=AutomationControlled`
- 导航策略：`waitUntil: 'commit'` + sleep 等待 JS 挑战
- 知乎渐进式滚动加载（400px 步长）
- `content-extractor.ts`：多站点正文提取，含知乎嵌入噪音清理

## 关键文件
- `apps/web/src/components/layout/TopBarSearch.tsx` — 搜索框组件
- `apps/web/src/components/search/ResultModal.tsx` — 结果弹窗
- `apps/web/src/app/api/proxy/search/route.ts` — 搜索 API
- `apps/web/src/app/api/proxy/fetch-page/route.ts` — 页面抓取 API
- `apps/web/src/app/api/clip/fetch/route.ts` — 剪藏 API
- `apps/web/src/lib/scraper.ts` — Playwright 抓取模块
- `apps/web/src/lib/content-extractor.ts` — 正文提取器
- `apps/web/src/lib/fetch-utils.ts` — 工具函数
- `apps/web/src/lib/cookies.ts` — Cookie 管理
- `apps/web/src/lib/zhihu-sign.ts` — x-zse-96 签名（备用）

## 已知问题/限制
- 知乎反爬需用户配置 Cookie（含 `z_c0`）
- Akamai Bot Manager 无法纯服务端绕过
- Playwright 依赖 Chromium（~300MB）
