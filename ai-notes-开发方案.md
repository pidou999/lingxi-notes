# AI Notes — 智能笔记系统 · 整体开发方案

## 一、项目定位

AI Notes 是一款**AI 驱动的智能笔记应用**，面向个人知识管理场景。核心理念：

> **收得进来、找得出去、AI 帮你思考**

- **收**：一键收藏公众号/知乎/网页，AI 自动清洗正文
- **存**：TipTap WYSIWYG 编辑器，Markdown 底层存储
- **找**：全文搜索 + 向量语义检索 + AI 自动分类标签
- **想**：AI 辅助写作、摘要、知识关联

---

## 二、技术架构

```
┌─────────────────────────────────────────────────────┐
│                     Clients                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Web App     │  │ Tauri Desktop│  │Extension  │ │
│  │ (Next.js 15)  │  │  (Tauri v2)  │  │(Post-MVP) │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┘ │
└─────────┼─────────────────┼─────────────────────────┘
          │ REST+JSON       │ IPC
┌─────────▼─────────────────▼─────────────────────────┐
│                    API Gateway                        │
│           Go 1.23 (chi + middleware stack)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐  │
│  │ Auth API │ │Notes API │ │  Clip/Collect API    │  │
│  │ JWT/RBAC │ │ CRUD+AI  │ │  Fetch → Parse→Save │  │
│  └──────────┘ └──────────┘ └──────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  Middleware: CORS / RateLimit / Logger / Auth  │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │    Redis     │ │    MinIO     │
│  16+pgvector │ │     7        │ │   S3存储     │
│  结构化数据  │ │ 缓存/会话   │ │  图片/附件   │
│  向量索引    │ │ 任务队列     │ │  导出文件    │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 技术选型理由

| 层 | 选型 | 理由 |
|----|------|------|
| 前端框架 | Next.js 15 (App Router) | SSR/SSG 灵活、RSC 流式渲染、生态成熟 |
| 编辑器 | TipTap (ProseMirror) | 结构化文档模型、扩展性强、协作基础 |
| 样式 | Tailwind CSS 4 | 原子化 CSS、构建时优化、主题切换 |
| 桌面端 | Tauri v2 | 包体小、Rust 性能、可调原生 API |
| 后端 API | Go 1.23 + chi | 性能好、goroutine 并发、部署简单 |
| 数据库 | PostgreSQL 16 + pgvector | 关系数据 + 向量检索合一，无需额外向量库 |
| 缓存 | Redis 7 | 会话管理、缓存、消息队列 |
| 对象存储 | MinIO (S3 兼容) | 自托管图片/附件，兼容 AWS S3 |
| 文章抓取 | 后端 Playwright | 支持 SSR 和 SPA 站点、Cookie 注入 |
| AI 接口 | OpenAI 兼容 API | 灵活切换供应商 |

---

## 三、模块拆解与实施路线

### Phase 1：基础框架（当前进度 → 已完成 60%）

```
状态说明：
  ✅ 已完成    ⏳ 部分完成    📋 待开发
```

#### 1.1 前端骨架 ✅
- [x] Next.js 15 App Router 项目初始化
- [x] TipTap 编辑器（StarterKit + Image + Link）
- [x] Tailwind CSS 4 + 暗色主题
- [x] 基础 UI 组件库（Button/Input/Modal/Sidebar/Switch）
- [x] SVG 图标库
- [x] 路由框架：(auth)/(dashboard) 分组
- [x] 登录/注册页面（UI 完成，未接后端）

#### 1.2 后端骨架 ✅
- [x] Go 项目结构 (cmd/internal/pkg)
- [x] chi 路由 + 中间件栈 (CORS/Logger/Recover/Throttle)
- [x] PostgreSQL 连接 + 自动迁移
- [x] Docker Compose (Postgres+pgvector/Redis/MinIO)
- [x] 数据库模型：users / notes / tags / collections
- [x] 健康检查端点

#### 1.3 数据模型 ✅
- [x] User：认证基础
- [x] Note：标题 + 内容 + JSON 结构 + 向量嵌入
- [x] Tag + Collection：组织分类
- [x] 软删除、时间戳

### Phase 2：核心笔记功能（当前 → ⏳ 30%）

#### 2.1 笔记 CRUD API 📋
- [ ] POST /api/notes — 创建笔记
- [ ] GET /api/notes — 列表（分页/搜索/标签过滤）
- [ ] GET /api/notes/:id — 单条
- [ ] PATCH /api/notes/:id — 更新（增量）
- [ ] DELETE /api/notes/:id — 软删除
- [ ] Go handler + pgx 查询

#### 2.2 前端笔记对接 ⏳
- [x] localStorage 存储（临时 Demo 方案）
- [ ] 替换为 Go API 调用（fetch → 后端）
- [ ] 自动保存（debounce + 增量更新）
- [ ] 笔记列表（分页加载、搜索、标签筛选）

#### 2.3 编辑器完善 ⏳
- [x] TipTap 基础集成
- [x] 图片上传（拖拽/粘贴 → /api/upload/image）
- [ ] Markdown 粘贴解析
- [ ] `/clip/fetch` 图文混排内容的图片渲染验证 ⚠️ 当前卡点

### Phase 3：链接收藏（当前 → ⏳ 50%）

#### 3.1 前端弹窗 ✅
- [x] ClipDialog 输入 URL → 预览 → 保存
- [x] 抓取状态反馈

#### 3.2 抓取 API ⏳
- [x] 基础路由框架
- [x] 下载图片到 /uploads/
- ⏳ 微信 `data-src` 优先（已修复，需验证）
- ⏳ Turndown 自定义规则（已修复，需验证）
- ⏳ 图片扩展名 wx_fmt 识别（已修复，需验证）
- ⏳ 微信 Referer 防盗链（已修复，需验证）
- 📋 知乎 Playwright 集成（需要启动浏览器服务）

#### 3.3 图片存储方案需决策
```
选项 A：本地 public/uploads（当前）→ 适合单机/Docker
  优点：无额外依赖，Next.js 直接 serve
  缺点：扩展性差，多实例需共享存储

选项 B：MinIO S3 → 适合生产
  需要：Go 后端提供 /api/images/:id → 从 MinIO 读出 → 返回
  前端：图片 URL 指向 Go API，不走 public/
```

### Phase 4：AI 功能（Post-MVP）

#### 4.1 AI 辅助写作 📋
- [ ] AI 续写 / 改写 / 扩写（TipTap 内选区调 AI）
- [ ] 摘要生成
- [ ] 标签自动推荐

#### 4.2 语义检索 📋
- [ ] pgvector 向量索引
- [ ] 笔记 → embedding 存储
- [ ] 语义搜索（"我上次记的关于 Docker 网络配置的笔记"）

#### 4.3 知识关联 📋
- [ ] 相似笔记推荐
- [ ] 知识图谱可视化

### Phase 5：多端部署（Future）

#### 5.1 Tauri 桌面端 📋
- [ ] 本地离线存储
- [ ] 系统托盘快速记录
- [ ] 全局快捷键截屏/剪藏

#### 5.2 浏览器扩展 📋
- [ ] 一键剪藏
- [ ] 自动提取正文

---

## 四、当前开发聚焦

### 当前 Sprint（链接收藏功能完善）

```
优先级 P0（阻塞）：
  P0-1 验证 TipTap 渲染本地图片 ✓/✗
        → 如果失败：改 TipTapEditor 配置或换渲染方式

优先级 P1（核心链路）：
  P1-1 /api/clip/fetch 微信抓取端到端测试
  P1-2 图片下载正确性验证
  P1-3 前端 marked.parse() 可用性验证

优先级 P2（体验完善）：
  P2-1 知乎文章抓取
  P2-2 通用站点 fallback 兜底
  P2-3 抓取失败友好提示
```

### 后续 Sprint 建议

```
Sprint 2：Go API 笔记 CRUD → 前端 localStorage 替换为后端
Sprint 3：用户认证 JWT + 登录注册对接
Sprint 4：AI 能力接入
Sprint 5：Tauri Desktop 打包
```

---

## 五、项目文件索引

| 路径 | 说明 |
|------|------|
| `apps/web/` | Next.js 前端应用 |
| `apps/web/src/app/(dashboard)/notes/` | 笔记列表 + 编辑器页面 |
| `apps/web/src/app/api/clip/fetch/route.ts` | 🔧 正在修复：文章抓取 API |
| `apps/web/src/app/api/upload/image/route.ts` | 图片上传 API |
| `apps/web/src/components/editor/` | TipTap 编辑器组件 |
| `apps/web/src/components/clip/ClipDialog.tsx` | 链接收藏弹窗 |
| `apps/web/src/lib/storage.ts` | ⏳ 临时 localStorage，待替换 |
| `services/api/` | Go 后端 API |
| `services/api/cmd/server/main.go` | API 入口 |
| `services/api/internal/handler/` | API 处理器 |
| `services/api/migrations/` | 数据库迁移 |
| `packages/shared-types/` | 前后端共享类型 |
| `packages/ui-kit/` | UI 组件库 |
| `packages/icons/` | SVG 图标库 |
| `docker/compose.yml` | 开发环境 Docker 编排 |

## 六、依赖关系图

```
启动开发环境：
  docker compose up -d         ← PostgreSQL + Redis + MinIO
  cd apps/web && pnpm dev      ← Next.js 前端 :8877
  go run ./cmd/server           ← Go API :8080

请求流程（生产）：
  浏览器 → Next.js (SSR) → Go API → PostgreSQL
                        ↘ MinIO (图片)
                        ↘ Redis (缓存)

请求流程（当前开发）：
  浏览器 → Next.js → localStorage (无后端)
                  → public/uploads/ (图片)
                  → /api/clip/fetch (SSR 直接请求)
```

---

*方案版本：v1.0 / 2026-07-07*
