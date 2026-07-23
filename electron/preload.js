const { contextBridge } = require('electron');

// 暴露有限的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
});
