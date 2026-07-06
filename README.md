# AI Notes - 智能笔记系统

AI 驱动的智能笔记应用，支持多端部署、多用户协作。

## 技术栈

- **前端**: Next.js 15 + TipTap + Tailwind CSS
- **桌面端**: Tauri v2
- **后端**: Go 1.23+ (chi + sqlc + pgx)
- **数据库**: PostgreSQL 16 + pgvector
- **缓存**: Redis 7
- **存储**: MinIO / S3
- **抓取**: Playwright

## 快速开始

```bash
# 启动开发环境
docker compose -f docker/compose.yml up -d

# 安装前端依赖
cd apps/web && pnpm install && pnpm dev

# 启动 Go API
cd services/api && go run ./cmd/server
```

## 项目结构

```
ai-notes/
├── apps/          # 可部署的应用 (Web / Desktop / Extension)
├── services/      # 后端服务 (API / Scraper)
├── packages/      # 共享包 (types / ui-kit / icons)
├── docker/        # Docker 配置
├── docs/          # 文档 & ADR
└── scripts/       # 工具脚本
```

## 功能模块

1. ✍️ AI 笔记创建与编辑
2. 🏷️ AI 自动分类与标签
3. 🔗 链接一键收藏
4. 🌓 亮色/暗色主题
5. 📦 多格式导入导出
6. 👥 多用户协作
7. 🖥️ 多端部署 (Web/Desktop/Docker)
