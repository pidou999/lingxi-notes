@echo off
chcp 65001 >nul
title 灵犀 - 生产构建
echo ========================================
echo          灵犀 - 生产构建
echo ========================================
echo.

REM ---------- 1. 构建前端 ----------
echo [1/3] 构建前端静态文件...
cd /d "%~dp0apps\web"
call pnpm build
if %errorlevel% neq 0 (
    echo 前端构建失败！终止。
    exit /b 1
)
echo 前端构建成功 ✓
echo.

REM ---------- 2. 复制静态文件 ----------
echo [2/3] 复制静态文件到后端...
if exist "%~dp0apps\server\static" rmdir /s /q "%~dp0apps\server\static"
xcopy /E /I /Y "%~dp0apps\web\out" "%~dp0apps\server\static" >nul
echo 复制完成 ✓
echo.

REM ---------- 3. 构建后端 ----------
echo [3/3] 构建后端单二进制...
cd /d "%~dp0apps\server"
go build -ldflags="-s -w" -o lingxi-server.exe
if %errorlevel% neq 0 (
    echo 后端构建失败！终止。
    exit /b 1
)
echo 后端构建成功 ✓
echo.

REM ---------- 清理临时文件 ----------
echo 清理临时文件...
if exist "%~dp0apps\server\static" rmdir /s /q "%~dp0apps\server\static"
echo.

echo ========================================
echo  构建完成！运行 lingxi-server.exe -prod
echo ========================================
echo  默认端口 :8877（单端口，无需前端服务器）
echo  访问地址: http://localhost:8877
echo ========================================
