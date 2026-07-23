#Requires -Version 7.0
param([string]$InstallDir = "lingxi-notes",[switch]$SkipPlaywright)
$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/pidou999/lingxi-notes.git"
Write-Host "Lingxi Notes - 一键部署"
if (-not (Get-Command node -EA 0)) { Write-Host "请先安装 Node.js: https://nodejs.org"; exit 1 }
Write-Host "Node.js $(node -v)"
if (-not (Get-Command pnpm -EA 0)) { npm install -g pnpm }
Write-Host "pnpm $(pnpm -v)"
if (Test-Path $InstallDir) { Push-Location $InstallDir; git pull origin main }
else { git clone $RepoUrl $InstallDir; Push-Location $InstallDir }
pnpm install
if (-not $SkipPlaywright) { Push-Location apps/web; npx playwright install chromium; Pop-Location }
pnpm build
Pop-Location
Write-Host "安装完成！启动: cd $InstallDir && pnpm --filter @ai-notes/web start --port 8877"