#!/usr/bin/env bash
# ============================================================
# 灵犀笔记 (Lingxi Notes) — 一键部署脚本
# 支持 Linux / macOS / WSL
# 用法:
#   curl -fsSL https://raw.githubusercontent.com/pidou999/lingxi-notes/main/scripts/bootstrap.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/pidou999/lingxi-notes/main/scripts/bootstrap.sh | bash -s my-notes
#   PLAYWRIGHT=no CHINA=no curl -fsSL ... | bash
# ============================================================
set -euo pipefail

REPO_URL="https://github.com/pidou999/lingxi-notes.git"
INSTALL_DIR="${1:-lingxi-notes}"
PLAYWRIGHT="${PLAYWRIGHT:-yes}"       # yes/no — 是否安装 Playwright（网页剪藏）
CHINA="${CHINA:-yes}"                 # yes/no — 是否使用国内镜像加速
SERVICE="${SERVICE:-yes}"             # yes/no — 是否安装 systemd 开机自启

# ---------- 颜色输出 ----------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERR]${NC} $1"; }

# ============================================================
# 1. 系统依赖检测与安装
# ============================================================
info "=== 1/6 系统依赖检测 ==="

# Node.js
if ! command -v node &>/dev/null; then
  warn "Node.js 未安装，正在安装..."
  if [ "$CHINA" = "yes" ]; then
    NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node \
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  else
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  fi
  apt-get install -y nodejs git 2>/dev/null || true
fi
ok "Node.js $(node -v)"

# pnpm
if ! command -v pnpm &>/dev/null; then
  warn "pnpm 未安装，正在安装..."
  corepack enable 2>/dev/null || npm install -g pnpm
fi
[ "$CHINA" = "yes" ] && pnpm config set registry https://registry.npmmirror.com 2>/dev/null || true
ok "pnpm $(pnpm -v)"

# Git
if ! command -v git &>/dev/null; then
  apt-get install -y git 2>/dev/null || pacman -S git 2>/dev/null || true
fi

# Go
GO_VERSION="1.26.5"
if ! command -v go &>/dev/null || [ "$(go version | grep -oP 'go\K[0-9]+\.[0-9]+')" != "1.26" ]; then
  info "Go ${GO_VERSION} 未安装，正在下载..."
  ARCH="linux-amd64"
  [ "$(uname)" = "Darwin" ] && ARCH="darwin-amd64"
  [ "$(uname -m)" = "arm64" ] || [ "$(uname -m)" = "aarch64" ] && ARCH="${ARCH/amd64/arm64}"
  GO_TAR="go${GO_VERSION}.${ARCH}.tar.gz"
  if [ "$CHINA" = "yes" ]; then
    curl -sL -o "/tmp/${GO_TAR}" "https://mirrors.ustc.edu.cn/golang/${GO_TAR}"
  else
    curl -sL -o "/tmp/${GO_TAR}" "https://go.dev/dl/${GO_TAR}"
  fi
  rm -rf /usr/local/go
  tar -C /usr/local -xzf "/tmp/${GO_TAR}"
  ln -sf /usr/local/go/bin/go /usr/local/bin/go
  ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt
  rm -f "/tmp/${GO_TAR}"
fi
# Go 国内镜像
[ "$CHINA" = "yes" ] && export GOPROXY=https://goproxy.cn,direct
ok "Go $(go version | grep -oP 'go\S+')"

# ============================================================
# 2. 克隆/更新代码
# ============================================================
info "=== 2/6 获取代码 ==="
if [ -d "$INSTALL_DIR" ]; then
  cd "$INSTALL_DIR" && git pull origin main
else
  git clone "$REPO_URL" "$INSTALL_DIR" && cd "$INSTALL_DIR"
fi
PROJECT_DIR="$(pwd)"
ok "代码已就绪: ${PROJECT_DIR}"

# ============================================================
# 3. 安装前端依赖 & 构建
# ============================================================
info "=== 3/6 前端依赖安装 ==="
pnpm install
ok "前端依赖安装完成"

# Playwright（可选）
if [ "$PLAYWRIGHT" = "yes" ]; then
  info "安装 Playwright Chromium（网页剪藏功能）..."
  cd apps/web
  if [ "$CHINA" = "yes" ]; then
    PLAYWRIGHT_BROWSERS_URL=https://npmmirror.com/mirrors/playwright \
      npx playwright install chromium 2>&1 | tail -3 || warn "Playwright 安装失败（可忽略，剪藏功能不可用）"
  else
    npx playwright install chromium 2>&1 | tail -3 || warn "Playwright 安装失败（可忽略，剪藏功能不可用）"
  fi
  cd ../..
fi
ok "前端依赖就绪"

# ============================================================
# 4. 构建前端 & 后端
# ============================================================
info "=== 4/6 构建 ==="
info "构建前端..."
pnpm build
ok "前端构建完成"

info "构建 Go 后端..."
cd apps/server
go mod tidy
go build -ldflags="-s -w" -o lingxi-server .
cd "$PROJECT_DIR"
ok "后端构建完成 ($(ls -lh apps/server/lingxi-server | awk '{print $5}'))"

# ============================================================
# 5. 生成密钥 & 创建 .env
# ============================================================
info "=== 5/6 密钥配置 ==="
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
CRYPTO_KEY="${CRYPTO_KEY:-$(openssl rand -hex 32)}"

cat > apps/server/.env << EOF
# 灵犀笔记 — 服务端环境变量
JWT_SECRET=${JWT_SECRET}
CRYPTO_KEY=${CRYPTO_KEY}
EOF
ok "密钥已生成并保存至 apps/server/.env"

# ============================================================
# 6. 安装 systemd 服务（Linux）
# ============================================================
if [ "$SERVICE" = "yes" ] && [ "$(uname)" = "Linux" ] && command -v systemctl &>/dev/null; then
  info "=== 6/6 安装系统服务（开机自启）==="

  # Go 后端服务
  cat > /etc/systemd/system/lingxi-server.service << SERVICEEOF
[Unit]
Description=Lingxi Notes — Go API Server
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${PROJECT_DIR}/apps/server
ExecStart=${PROJECT_DIR}/apps/server/lingxi-server
Restart=on-failure
RestartSec=5
EnvironmentFile=${PROJECT_DIR}/apps/server/.env
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
SERVICEEOF

  # Next.js 前端服务
  cat > /etc/systemd/system/lingxi-web.service << SERVICEEOF2
[Unit]
Description=Lingxi Notes — Next.js Frontend
After=network.target lingxi-server.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${PROJECT_DIR}/apps/web
ExecStart=$(which pnpm) run start --port 8877
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICEEOF2

  systemctl daemon-reload
  systemctl enable lingxi-server lingxi-web
  systemctl restart lingxi-server lingxi-web

  ok "服务已安装并启动"

  # 稍等片刻后检查状态
  sleep 3
  echo ""
  echo "  🔍 后端状态: $(systemctl is-active lingxi-server)"
  echo "  🔍 前端状态: $(systemctl is-active lingxi-web)"
else
  info "跳过系统服务安装（非 Linux systemd 环境）"
  info "手动启动方式："
  echo "  cd ${PROJECT_DIR}/apps/server && ./lingxi-server &"
  echo "  cd ${PROJECT_DIR}/apps/web  && pnpm start --port 8877"
fi

# ============================================================
# 完成
# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           🎉 灵犀笔记 部署完成！                        ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  前端地址:  http://localhost:8877                       ║"
echo "║  后端 API:  http://localhost:8888                       ║"
echo "║  工作目录:  ${PROJECT_DIR}                              ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  管理命令:                                             ║"
echo "║  systemctl status lingxi-server    # 后端状态           ║"
echo "║  systemctl status lingxi-web       # 前端状态           ║"
echo "║  journalctl -u lingxi-server -f    # 后端日志           ║"
echo "║  journalctl -u lingxi-web -f       # 前端日志           ║"
echo "╚══════════════════════════════════════════════════════════╝"
