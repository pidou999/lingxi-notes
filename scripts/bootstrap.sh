#!/usr/bin/env bash
set -euo pipefail
REPO_URL="https://github.com/pidou999/lingxi-notes.git"
INSTALL_DIR="${1:-lingxi-notes}"
PLAYWRIGHT="${PLAYWRIGHT:-yes}"
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs git
fi
echo "Node.js $(node -v)"
corepack enable 2>/dev/null || npm install -g corepack
corepack prepare pnpm@latest --activate 2>/dev/null || npm install -g pnpm
echo "pnpm $(pnpm -v)"
if [ -d "$INSTALL_DIR" ]; then cd "$INSTALL_DIR" && git pull origin main
else git clone "$REPO_URL" "$INSTALL_DIR" && cd "$INSTALL_DIR"
fi
pnpm install
if [ "$PLAYWRIGHT" = "yes" ]; then cd apps/web && npx playwright install chromium && cd ../..; fi
pnpm build
echo "安装完成！启动: cd $INSTALL_DIR && pnpm --filter @ai-notes/web start --port 8877"