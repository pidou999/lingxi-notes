const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 8877;

let mainWindow = null;
let serverProcess = null;
let serverReady = false;

// 判断是开发模式还是打包模式
const isPackaged = app.isPackaged;

function getResourcesPath() {
  if (isPackaged) {
    return path.join(process.resourcesPath, 'web');
  }
  // 开发模式下，直接从 apps/web 目录用
  return path.join(__dirname, '..', 'apps', 'web');
}

function startServer() {
  return new Promise((resolve, reject) => {
    const webPath = getResourcesPath();
    console.log(`[Electron] 服务器路径: ${webPath}`);

    // 检查 node_modules 是否存在（确保依赖可用）
    const nodeModulesPath = path.join(webPath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.error(`[Electron] 错误: node_modules 不存在于 ${nodeModulesPath}`);
      reject(new Error('node_modules not found'));
      return;
    }

    // 检查 .next 目录
    const nextPath = path.join(webPath, '.next');
    if (!fs.existsSync(nextPath)) {
      console.error(`[Electron] 错误: .next 目录不存在于 ${nextPath}`);
      reject(new Error('.next directory not found'));
      return;
    }

    // 启动 Next.js 生产服务器
    const nodeExe = process.execPath;
    console.log(`[Electron] 启动 Node.js 服务器 (${nodeExe})`);

    serverProcess = spawn(nodeExe, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], {
      cwd: webPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(PORT),
      },
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Next.js] ${output.trim()}`);
      if (output.includes('http://localhost:' + PORT) || output.includes('ready')) {
        serverReady = true;
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`[Next.js:err] ${output.trim()}`);
      // 有时 ready 日志走 stderr
      if (!serverReady && (output.includes('http://localhost:' + PORT) || output.includes('ready'))) {
        serverReady = true;
        resolve();
      }
    });

    serverProcess.on('error', (err) => {
      console.error(`[Electron] 服务器启动失败:`, err);
      reject(err);
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`[Electron] 服务器已退出 (code: ${code}, signal: ${signal})`);
      serverProcess = null;
      serverReady = false;
    });

    // 超时处理（30 秒）
    setTimeout(() => {
      if (!serverReady) {
        // 仍然尝试连接，可能服务器稍后就绪
        console.warn('[Electron] 服务器启动超时，仍尝试连接...');
        resolve();
      }
    }, 30000);
  });
}

function killServer() {
  if (serverProcess) {
    console.log('[Electron] 关闭服务器...');
    try {
      if (process.platform === 'win32') {
        // Windows 上用 taskkill 杀进程树
        spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t']);
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error('[Electron] 关闭服务器出错:', e);
    }
    serverProcess = null;
    serverReady = false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '灵犀笔记',
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 加载本地服务
  const url = `http://localhost:${PORT}`;
  console.log(`[Electron] 加载页面: ${url}`);

  // 尝试加载，最多重试 5 次
  let retries = 0;
  const maxRetries = 30;

  function tryLoad() {
    mainWindow.loadURL(url).catch((err) => {
      retries++;
      if (retries < maxRetries) {
        console.log(`[Electron] 等待服务器就绪 (${retries}/${maxRetries})...`);
        setTimeout(tryLoad, 1000);
      } else {
        console.error('[Electron] 无法连接到服务器:', err);
        dialog.showErrorBox('启动失败', '无法启动灵犀笔记服务，请检查端口 8877 是否被占用。');
      }
    });
  }

  // 给服务器一些启动时间
  setTimeout(tryLoad, 1000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用生命周期
app.whenReady().then(async () => {
  try {
    console.log('[Electron] 启动 Next.js 服务器...');
    await startServer();
    console.log('[Electron] 服务器就绪，创建窗口...');
    createWindow();
  } catch (err) {
    console.error('[Electron] 启动失败:', err);
    dialog.showErrorBox('启动失败', `无法启动灵犀笔记: ${err.message}`);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  killServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killServer();
});
