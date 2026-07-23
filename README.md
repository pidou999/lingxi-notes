# Lingxi Notes（灵犀笔记）— AI 智能笔记系统

AI 驱动的智能笔记应用，支持知识图谱、AI 问答、网页剪藏、多格式导出。

> 技术预览版 — 目前以前端为主，数据存储在本地（localStorage），Go 后端提供可选服务端持久化。

---

## 功能一览

| 功能 | 说明 |
|------|------|
| ✍️ **富文本编辑器** | TipTap 驱动，支持表格、代码块、图片拖拽上传、WikiLink 双向链接 |
| 🧠 **AI 问答** | 内置 AI 聊天面板，支持多模型切换（OpenAI / Anthropic / 自定义） |
| 🔗 **网页剪藏** | 输入 URL 自动提取正文内容，保存为笔记（支持 Playwright） |
| 🏷️ **AI 标签推荐** | 基于笔记内容自动推荐标签 |
| 🌐 **知识图谱** | d3-force 驱动的可视化关系图，悬停高亮、分组筛选、孤立节点识别 |
| 🔍 **智能搜索** | 关键词搜索 + 语义搜索（embedding），区分标题/内容/匹配理由 |
| 📤 **多格式导出** | Markdown、DOCX 文档导出，图片自动嵌入 |
| 🔒 **笔记加密** | 密码保护笔记，SHA-256 哈希验证 |
| 🌓 **暗色模式** | 全组件暗色主题覆盖 |
| 📱 **响应式** | 桌面端侧边栏 + 移动端底部导航栏适配 |

---

## 快速开始

```bash
# 1. 安装 pnpm
corepack enable
corepack prepare pnpm@latest --activate

# 2. 克隆并安装依赖
git clone https://github.com/pidou999/lingxi-notes.git
cd lingxi-notes
pnpm install

# 3. 安装 Playwright Chromium（可选，用于网页抓取）
cd apps/web && npx playwright install chromium && cd ../..

# 4. 构建并启动
pnpm build
pnpm --filter @ai-notes/web start --port 8877
```

浏览器打开 `http://localhost:8877` 即可使用。

---

## 技术栈

| 层 | 技术 |
|------|------|
| **前端框架** | Next.js 15 (React 19) |
| **编辑器** | TipTap (ProseMirror) |
| **样式** | Tailwind CSS v4 |
| **后端（可选）** | Go 1.23+ / Chi / SQLite（apps/server） |
| **知识图谱** | d3-force |
| **网页抓取** | Playwright + Chromium |
| **文档导出** | html-to-docx-js / marked |
| **图标** | 自建 React SVG 图标库 |

---

## 项目结构

```
lingxi-notes/
├── apps/
│   ├── web/              # Next.js 前端应用（主入口）
│   └── server/           # Go 后端（可选，SQLite + API）
├── services/
│   └── api/              # Go 微服务骨架（PostgreSQL）
├── packages/
│   ├── icons/            # 图标组件库
│   ├── shared-types/     # 共享 TS 类型定义
│   └── ui-kit/           # UI 组件库（Button、Modal、Input）
├── docs/                 # 设计文档
└── electron/             # 桌面客户端（Electron，实验性）
```

---

## 部署

详见 [部署指南](https://github.com/pidou999/lingxi-notes)：
- **Vercel** — 一键部署（推荐，最简单）
- **VPS** — 完整功能部署（含 Playwright 网页抓取）
- **Windows** — 本机/服务器部署

---

## 环境变量

前端可不配 `.env` 直接运行，AI API Key 在应用内「设置」页面配置。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | Go 后端数据库连接 | 无默认（必填） |
| `ENCRYPTION_KEY` | API Key 加密密钥（Go 后端） | 无默认 |

---

## 设计亮点

- **安全**: 密码 SHA-256 哈希、Token Web Crypto AES-GCM 加密、API Key AES-GCM 存储、SSRF 防护、Link URL 白名单
- **离线优先**: 数据以 localStorage 为主，登录后通过 API 同步到服务端
- **混合数据源**: 搜索/标签/图谱同时查询本地存储和 API 后合并结果
- **暗色模式**: 所有组件覆盖 `dark:` 变体

---

## License

MIT
