/**
 * 隐身脚本模块 — 模拟真实 Chrome 浏览器的各项指纹特征
 *
 * 针对 Akamai Bot Manager 等高级反爬系统的检测维度全面覆盖。
 * 包括：WebDriver、Plugins、Languages、Chrome Runtime、Permissions、WebGL、硬件信息等。
 */
export function stealthInitScript(): string {
  return `
(() => {
  // ===== 1. WebDriver 标志 =====
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // ===== 2. Plugins（真实的 PluginArray 结构） =====
  {
    const pluginData = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
    ];
    const arr = Object.assign([], {
      length: pluginData.length,
      item: (i) => arr[i] || null,
      namedItem: (n) => arr.find(a => a.name === n) || null,
      [Symbol.iterator]: function* () { for (let i = 0; i < this.length; i++) yield this[i]; },
    });
    pluginData.forEach((p, i) => { arr[i] = p; });
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        arr.length = pluginData.length;
        return arr;
      },
    });
  }

  // ===== 3. Languages =====
  Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });

  // ===== 4. Chrome Runtime（完整的 chrome 对象） =====
  if (typeof window.chrome === 'undefined' || !window.chrome) {
    window.chrome = {};
  }
  const chromeObj = window.chrome;
  chromeObj.runtime = {
    id: 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz',
    connect: function(){ return { onMessage: { addListener: function(){} }, onDisconnect: { addListener: function(){} } }; },
    sendMessage: function(){},
    onConnect: { addListener: function(){} },
    onMessage: { addListener: function(){} },
    onInstalled: { addListener: function(){} },
    lastError: undefined,
  };
  chromeObj.loadTimes = function() {
    return {
      requestTime: 0,
      startLoadTime: 0,
      commitLoadTime: 0,
      finishDocumentLoadTime: 0,
      finishLoadTime: 0,
      firstPaintTime: 0,
      firstPaintAfterLoadTime: 0,
      navigationType: 'Reload',
      wasFetchedViaSpdy: false,
      wasNpnNegotiated: false,
      npnNegotiatedProtocol: 'http/1.1',
      wasAlternateProtocolAvailable: false,
      connectionInfo: 'http/1.1',
    };
  };
  chromeObj.csi = function(){ return { onloadT: 0, startE: 0, onloadTStart: 0 }; };
  chromeObj.app = { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } };
  chromeObj.webstore = { onInstallStageChanged: {}, onDownloadProgress: {} };

  // ===== 5. Permissions =====
  {
    const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
    if (originalQuery) {
      window.navigator.permissions.query = (params) => {
        if (params && (params.name === 'notifications' || params.name === 'midi' || params.name === 'clipboard-write')) {
          return Promise.resolve({ state: 'granted', onchange: null });
        }
        return originalQuery(params);
      };
    }
  }

  // ===== 6. WebGL 指纹模拟 =====
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const origGetParam = gl.getParameter.bind(gl);
        gl.getParameter = function(p) {
          if (p === debugInfo.UNMASKED_VENDOR_WEBGL) return 'Google Inc. (Intel)';
          if (p === debugInfo.UNMASKED_RENDERER_WEBGL) return 'ANGLE (Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)';
          return origGetParam(p);
        };
      }
    }
  } catch(e) {}

  // ===== 7. 硬件信息 =====
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

  // ===== 8. Screen =====
  Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
  Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

  // ===== 9. MediaCodecs（移除空 codecs） =====
  try {
    const origCreate = MediaSource.isTypeSupported;
    if (origCreate) {
      MediaSource.isTypeSupported = function(mime) {
        if (!mime || mime === '' || mime === ' ') return false;
        return origCreate.call(MediaSource, mime);
      };
    }
  } catch(e) {}

  // ===== 10. iframe 相关 =====
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    get: function() {
      return this.contentWindow;
    },
  });

  // ===== 11. addEventListener / removeEventListener =====
  Object.defineProperty(window, 'addEventListener', {
    value: function(type, listener, options) {
      return EventTarget.prototype.addEventListener.call(window, type, listener, options);
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'removeEventListener', {
    value: function(type, listener, options) {
      return EventTarget.prototype.removeEventListener.call(window, type, listener, options);
    },
    writable: true,
    configurable: true,
  });
})();
`;
}
