const fs = require("fs");
const path = require("path");

const outputPath = "D:\\开发项目\\ai-notes-完善建议.md";

const content = `# ai-notes（灵犀）项目完善建议报告

> 生成日期：2026-07-20
> 项目路径：D:\\开发项目\\ai-notes

---

## 一、项目概述

**ai-notes（灵犀）** 是一个功能丰富的 AI 笔记应用，采用 pnpm monorepo 架构：

| 模块 | 技术栈 | 说明 |
|------|--------|------|
| apps/web/ | Next.js 15 + React 19 + Tailwind CSS v4 + Tiptap | 前端应用（端口 8877） |
| apps/server/ | Go + Chi + SQLite | 单机版后端（完整业务） |
| services/api/ | Go + Chi + PostgreSQL | 微服务版后端（骨架阶段） |
| packages/icons/ | React SVG | 图标组件库 |
| packages/shared-types/ | TypeScript | 共享类型定义 |
| packages/ui-kit/ | React | UI 组件库（Button、Modal、Input） |

**总体评价**: 项目架构设计合理，功能丰富（知识图谱、AI 聊天、网页剪藏、文档导出等），暗色模式覆盖全面，整体代码质量良好。但在**后端集成**、**类型安全**、**密码安全**、**代码拆分**等方面存在需要完善的问题。

---

## 二、严重问题（必须优先修复）

### 2.1 前端未接入后端 API，数据仅存本地

- **涉及文件**:
  - [apps/web/src/app/(dashboard)/notes/page.tsx](file:///D:/开发项目/ai-notes/apps/web/src/app/(dashboard)/notes/page.tsx)
  - [apps/web/src/app/(dashboard)/edit/page.tsx](file:///D:/开发项目/ai-notes/apps/web/src/app/(dashboard)/edit/page.tsx)
  - [apps/web/src/lib/api.ts](file:///D:/开发项目/ai-notes/apps/web/src/lib/api.ts)
- **现状**: 所有页面直接使用 \`@/lib/storage\`（localStorage）存取数据。\`@/lib/api.ts\` 中已定义好的 \`apiListNotes\`、\`apiCreateNote\`、\`apiUpdateNote\` 等函数**完全未被调用**
- **影响**: 数据无服务端持久化，切换设备或清空浏览器缓存后数据全部丢失，严重偏离架构设计
- **建议**: 将数据源从 localStorage 切换到 API 层，或建立双向同步机制（如 Service Worker + IndexedDB 配合 API 同步）

### 2.2 类型定义前后端不一致

- **涉及文件**:
  - [apps/web/src/lib/types.ts](file:///D:/开发项目/ai-notes/apps/web/src/lib/types.ts)
  - [apps/web/src/lib/api.ts](file:///D:/开发项目/ai-notes/apps/web/src/lib/api.ts)
- **问题详情**:

| 字段 | types.ts 定义 | api.ts 定义 | 风险 |
|------|--------------|-------------|------|
| Note.json | Record<string, unknown>（对象） | string（字符串） | 切换到 API 时 Object.keys(note.json) 会崩溃 |
| Note.tags | string[]（数组） | string（字符串） | 遍历方法不兼容 |

- **建议**: 统一类型定义，以服务端实际返回的 JSON 格式为准

### 2.3 密码明文存储和比较

- **涉及文件**:
  - [apps/web/src/app/(dashboard)/notes/page.tsx#L294](file:///D:/开发项目/ai-notes/apps/web/src/app/(dashboard)/notes/page.tsx#L294)
  - [apps/web/src/app/(dashboard)/edit/page.tsx#L126](file:///D:/开发项目/ai-notes/apps/web/src/app/(dashboard)/edit/page.tsx#L126)
- **现状**: 使用 \`prompt()\` 获取密码，然后与 \`note.password\` 直接 \`===\` 比较；密码以明文存储在 localStorage 中
- **影响**: XSS 攻击可直接窃取所有笔记密码
- **建议**: 使用 \`crypto.subtle\` 在前端对密码进行 SHA-256 哈希处理，存储哈希值而非明文，验证时使用哈希比较；替换 \`prompt()\` 为自定义密码输入对话框组件

### 2.4 Go 后端 API Key 解密失败泄漏加密数据

- **涉及文件**:
  - [apps/server/providers.go#L40-L43](file:///D:/开发项目/ai-notes/apps/server/providers.go#L40-L43)
  - [apps/server/proxy.go#L59-L62](file:///D:/开发项目/ai-notes/apps/server/proxy.go#L59-L62)
  - [apps/server/proxy.go#L150-L153](file:///D:/开发项目/ai-notes/apps/server/proxy.go#L150-L153)
  - [apps/server/proxy.go#L227-L230](file:///D:/开发项目/ai-notes/apps/server/proxy.go#L227-L230)
- **现状**: \`decryptAPIKey\` 解密失败时直接将加密后的 hex 字符串返回给客户端或发送给 AI 服务

  \`\`\`
  key, err := decryptAPIKey(encryptedKey)
  if err != nil {
      key = encryptedKey  // 泄漏加密数据！
  }
  \`\`\`

- **影响**: 暴露内部加密数据结构，且用错误密钥调用 AI 服务导致认证失败
- **建议**: 解密失败时应返回错误或空字符串，而非泄漏加密数据

---

## 三、中等问题（建议尽快修复）

### 3.1 后端 API 安全加固

| 问题 | 文件 | 说明 | 建议 |
|------|------|------|------|
| 请求体未限制大小 | [apps/server/notes.go](file:///D:/开发项目/ai-notes/apps/server/notes.go) 等处 | 仅 proxy handler 有限制（1MB），其余 handler 无限制 | 为所有 handler 统一添加 http.MaxBytesReader |
| LIKE 搜索通配符未转义 | [apps/server/search.go#L16](file:///D:/开发项目/ai-notes/apps/server/search.go#L16) | 用户输入直接拼接到 LIKE 模式 pattern := "%" + q + "%" | 对 %、_、\\ 进行转义处理 |
| 认证端点无速率限制 | [apps/server/main.go#L36-L37](file:///D:/开发项目/ai-notes/apps/server/main.go#L36-L37) | 注册/登录接口可被暴力破解 | 添加基于 IP 或用户名的速率限制 |
| CORS 配置违规 | [services/api/cmd/server/main.go#L64-L71](file:///D:/开发项目/ai-notes/services/api/cmd/server/main.go#L64-L71) | AllowCredentials: true 与 AllowedOrigins: ["*"] 同时使用 | 浏览器禁止凭据模式下使用通配符 Origin，需明确指定 Origin |

### 3.2 数据一致性

| 问题 | 文件 | 说明 | 建议 |
|------|------|------|------|
| 离线 fallback 隐藏错误 | [apps/web/src/lib/auth.tsx#L47-L62](file:///D:/开发项目/ai-notes/apps/web/src/lib/auth.tsx#L47-L62) | API 失败后静默 fallback 到本地存储 | API 失败时明确报错，让用户知道后端不可用 |
| 删除后无事件通知 | [apps/web/src/app/(dashboard)/edit/page.tsx#L73-L75](file:///D:/开发项目/ai-notes/apps/web/src/app/(dashboard)/edit/page.tsx#L73-L75) | 编辑页删除笔记后未派发更新事件 | 删除时派发 ai-notes:note-changed 事件保持列表同步 |

### 3.3 Go 后端代码健壮性

| 问题 | 文件 | 建议 |
|------|------|------|
| 无优雅关闭 | [apps/server/main.go](file:///D:/开发项目/ai-notes/apps/server/main.go) | 监听 SIGTERM/SIGINT 信号，实现 Shutdown() |
| 数据库未使用 Context | apps/server/ 所有 handler | 所有 db.Query、db.QueryRow、db.Exec 传入 context.Context |
| rows.Scan 失败静默跳过 | [apps/server/notes.go#L36](file:///D:/开发项目/ai-notes/apps/server/notes.go#L36)、[apps/server/tags.go#L30](file:///D:/开发项目/ai-notes/apps/server/tags.go#L30)、[apps/server/trash.go#L32](file:///D:/开发项目/ai-notes/apps/server/trash.go#L32) | 添加日志记录 |
| rand.Read 错误忽略 | [apps/server/auth.go#L168](file:///D:/开发项目/ai-notes/apps/server/auth.go#L168) | 检查错误并处理 |
| 包级全局变量 | [apps/server/auth.go#L24-L30](file:///D:/开发项目/ai-notes/apps/server/auth.go#L24-L30) | 改为依赖注入方式以支持测试和密钥轮替 |
| 错误响应格式不统一 | apps/server/ 多处 | 统一使用 writeJSON 返回错误，或统一使用 http.Error |

### 3.4 微服务版 API（services/api/）问题

| 问题 | 文件 | 说明 |
|------|------|------|
| 默认数据库 URL 含硬编码凭据 | [services/api/internal/config/config.go#L16-L17](file:///D:/开发项目/ai-notes/services/api/internal/config/config.go#L16-L17) | postgres://ainotes:ainotes@localhost:5432/ainotes?sslmode=disable，生产环境忘记覆盖时存在风险 |
| 导入路径不一致 | cmd/server/main.go vs cmd/migrate/main.go | 一个用 internal/，一个用 pkg/ |
| 尚无业务 handler | services/api/ 整体 | 仅有 health check，微服务处于骨架阶段 |

### 3.5 前端代码质量

| 问题 | 文件 | 建议 |
|------|------|------|
| notes/page.tsx 文件过大（557 行） | [notes/page.tsx](file:///D:/开发项目/ai-notes/apps/web/src/app/(dashboard)/notes/page.tsx) | 将导出对话框、分页器、右键菜单拆分 |
| 编辑器自动保存无防抖 | [edit/page.tsx#L47-L53](file:///D:/开发项目/ai-notes/apps/web/src/app/(dashboard)/edit/page.tsx#L47-L53) | 添加 300-500ms 防抖 |
| 移动端使用 <a> 标签 | [DashboardLayout.tsx#L95](file:///D:/开发项目/ai-notes/apps/web/src/components/layout/DashboardLayout.tsx#L95) | 替换为 next/link 的 Link 组件 |
| URL 拼接使用字符串 | [notes/page.tsx#L122-L125](file:///D:/开发项目/ai-notes/apps/web/src/app/(dashboard)/notes/page.tsx#L122-L125) | 使用 encodeURI 或 DOMPurify 转义 |
| 注册时 email 参数丢失 | [auth.tsx#L66](file:///D:/开发项目/ai-notes/apps/web/src/lib/auth.tsx#L66) | 注册时 apiRegister 仅传了 username 和 password，未传递 email |

---

## 四、低优先级问题（可逐步完善）

### 4.1 大文件拆分

| 文件 | 行数 | 建议拆分方式 |
|------|------|-------------|
| [ForceGraphInner.tsx](file:///D:/开发项目/ai-notes/apps/web/src/components/graph/ForceGraphInner.tsx) | 516 行 | 按职责拆分为：数据 hook、渲染逻辑、侧边栏面板、颜色工具 |
| [EditorToolbar.tsx](file:///D:/开发项目/ai-notes/apps/web/src/components/editor/EditorToolbar.tsx) | 230 行 | 将工具栏按钮配置提取到独立的配置文件 |
| [notes/page.tsx](file:///D:/开发项目/ai-notes/apps/web/src/app/(dashboard)/notes/page.tsx) | 557 行 | 拆分导出对话框、分页器组件、操作菜单 |

### 4.2 代码重复

| 重复内容 | 涉及文件 | 建议 |
|----------|---------|------|
| escapeHtml 内联定义 | ChatPanel.tsx、SmartSearch.tsx | 提取为 @/lib/escape.ts 公共工具函数 |
| Dialog 骨架 | LinkDialog.tsx、ImageDialog.tsx | 提取公共 Modal 基础组件 |
| 图片上传处理 | TipTapEditor.tsx（drop/paste 两处重复） | 提取 handleImageFile(file) 复用函数 |
| 图谱 link 端点类型守卫 | ForceGraphInner.tsx 多处 | 提取 getLinkEndpoints 工具函数 |

### 4.3 类型安全

| 问题 | 文件 | 建议 |
|------|------|------|
| as any 绕过类型检查 | TagInput.tsx#L57、ForceGraphInner.tsx 等多处 | 逐步替换为具体类型 |
| 编辑器扩展类型 | TipTapEditor.tsx#L43 使用 any[] | 替换为 Extension[] |
| 图谱碰撞力类型 | ForceGraphInner.tsx 使用 as unknown as any | 实现正确的类型接口 |

### 4.4 UI/UX 细节

- **搜索无防抖**: [SmartSearch.tsx](file:///D:/开发项目/ai-notes/apps/web/src/components/search/SmartSearch.tsx) 每次输入都触发关键词搜索，建议添加 150ms 防抖
- **图谱文本截断**: [ForceGraphInner.tsx#L239](file:///D:/开发项目/ai-notes/apps/web/src/components/graph/ForceGraphInner.tsx#L239) 固定 14 个字符截断，中文英文差异大，建议按像素宽度截断
- **图谱自动缩放跳动**: [ForceGraphInner.tsx#L417](file:///D:/开发项目/ai-notes/apps/web/src/components/graph/ForceGraphInner.tsx#L417) 每次力模拟停止触发 zoomToFit，用户交互时画面跳动
- **搜索结果状态丢失**: [SmartSearch.tsx#L163-L167](file:///D:/开发项目/ai-notes/apps/web/src/components/search/SmartSearch.tsx#L163-L167) 导航到笔记后返回搜索页面，搜索状态丢失
- **工具栏无障碍优化**: [EditorToolbar.tsx](file:///D:/开发项目/ai-notes/apps/web/src/components/editor/EditorToolbar.tsx) 增加 aria-controls，在按钮上显示快捷键
- **图谱侧边栏筛选状态**: [ForceGraphInner.tsx](file:///D:/开发项目/ai-notes/apps/web/src/components/graph/ForceGraphInner.tsx) 分组筛选时缺乏明显的视觉反馈

### 4.5 网络层增强

- **请求超时**: 为 api.ts 的 request 函数添加 AbortSignal.timeout() 超时控制
- **自动重试**: 为 GET 类请求添加可选的自动重试机制（指数退避）
- **Token 静默刷新**: 当前 token 过期后直接跳转登录页，建议实现 refresh token 机制

### 4.6 配置与依赖

- 缺少 .env 文件（.env.example 存在但未复制），需要复制并配置各环境变量
- apps/server/go.mod 中 Chi 模块被错误标记为 // indirect，需运行 go mod tidy 修正
- 前端测试覆盖不足（目前仅有一个 search-filter.test.ts），建议逐步补充组件测试

---

## 五、项目中值得肯定的设计亮点

尽管存在上述问题，项目在很多方面做得非常好：

### 5.1 安全编程
- **LinkDialog URL 白名单**: 仅允许 http: 和 https: 协议，有效防止 javascript: XSS 攻击
- **ChatPanel HTML 转义**: AI 返回内容经过转义后插入 DOM
- **SSRF 防护**: Go 后端对代理请求进行了 DNS 解析校验和重定向验证
- **API 密钥加密**: 使用 AES-GCM 加密存储第三方 API 密钥
- **Token 加密存储**: 前端使用 Web Crypto AES-GCM 加密存储 JWT token

### 5.2 用户体验
- **暗色模式全面**: 所有组件都完整覆盖了 Tailwind 暗色模式变体（dark:）
- **知识图谱交互细腻**: 悬停高亮邻居节点、孤立节点可视化区分、分组筛选、图例说明
- **响应式设计完善**: 桌面端侧边栏 + 移动端底部导航栏适配良好
- **键盘操作支持**: Escape 关闭弹窗、Enter 提交标签、快捷键提示等
- **搜索结果详情丰富**: 区分标题、匹配理由、内容预览，显示搜索模式和结果数量

### 5.3 代码架构
- **monorepo 结构清晰**: workspace 划分合理，共享包独立管理
- **编辑器扩展机制良好**: TipTap 扩展独立文件、通过 props 暴露编辑器 API
- **状态管理简洁**: 使用 React Context + hooks 模式，无过度抽象
- **前后端分离清晰**: API 层统一抽象，方便切换数据源

### 5.4 功能丰富度
- **富文本编辑器**: 集成 TipTap，支持表格、代码块、图片拖拽上传、WikiLink
- **AI 功能**: AI 聊天对话、语义搜索、标签推荐
- **知识图谱**: 基于 d3-force 的可视化知识关系图
- **多格式导出**: Markdown、DOCX 文档导出
- **网页剪藏**: 支持内容提取、格式化后保存为笔记

---

## 六、修复优先级汇总

| 优先级 | 问题 | 预估工作量 |
|--------|------|-----------|
| **P0** | 前端接入后端 API | 3-5 天 |
| **P0** | 统一类型定义 | 0.5 天 |
| **P0** | 密码明文存储 → 哈希存储 | 1 天 |
| **P0** | 修复 API Key 解密泄漏 | 0.5 天 |
| **P1** | 后端安全加固（限流、限体、转义） | 1-2 天 |
| **P1** | 离线 fallback 逻辑修正 | 0.5 天 |
| **P1** | 数据库 Context 接入 | 1 天 |
| **P1** | 优雅关闭实现 | 0.5 天 |
| **P1** | 大文件拆分 | 1-2 天 |
| **P2** | 代码重复消除 | 1 天 |
| **P2** | 类型安全修复 | 1 天 |
| **P2** | 网络层增强（超时/重试） | 0.5 天 |
| **P2** | 移动端导航优化 | 0.5 天 |
| **P3** | UI/UX 细节优化 | 1-2 天 |
| **P3** | 测试覆盖补充 | 持续 |
| **P3** | 配置与依赖修正 | 0.5 天 |

> 本文档由 TRAE 代码分析自动生成，基于对项目全部源代码的静态分析。
`;

fs.writeFileSync(outputPath, content, "utf-8");
console.log("文件已写入: " + outputPath);
const stats = fs.statSync(outputPath);
console.log("文件大小: " + stats.size + " 字节");
