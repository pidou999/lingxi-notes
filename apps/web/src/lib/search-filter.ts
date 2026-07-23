/**
 * 搜索结果过滤规则 — 可配置
 *
 * 支持两种过滤方式：
 * 1. 域名黑名单：匹配 URL 的 hostname
 * 2. 关键词黑名单：匹配 title 或 snippet（大小写不敏感）
 *
 * 数据存储在 localStorage，格式为 JSON。
 */
import type { ProviderConfig } from './providers';
import { getProviders } from './providers';

const STORAGE_KEY = 'ai-notes:search-filters';

// ====== 类型定义 ======

export interface SearchFilterRule {
  /** 唯一 ID */
  id: string;
  /** 过滤类型：domain | keyword */
  type: 'domain' | 'keyword';
  /** 匹配模式：域名（github.com）或关键词（docs） */
  pattern: string;
  /** 是否启用 */
  enabled: boolean;
  /** 备注（用户自行添加） */
  note?: string;
}

export interface SearchFilterConfig {
  rules: SearchFilterRule[];
}

// ====== 默认规则 ======

const DEFAULT_RULES: SearchFilterRule[] = [
  // 域名类
  { id: 'domain-github-root', type: 'domain', pattern: 'github.com', enabled: false, note: 'GitHub 根页（已内置智能过滤，推荐关闭以避免误杀）' },
  // 关键词类
  { id: 'keyword-docs-landing', type: 'keyword', pattern: '^文档\\s', enabled: true, note: '文档首页标题' },
  { id: 'keyword-documentation', type: 'keyword', pattern: '^documentation', enabled: true, note: 'Documentation 首页标题' },
  { id: 'keyword-docs-title', type: 'keyword', pattern: '^docs\\b', enabled: true, note: 'Docs 首页标题' },
  { id: 'keyword-index-title', type: 'keyword', pattern: '^index of', enabled: true, note: 'Index of 目录页' },
  { id: 'keyword-home-title', type: 'keyword', pattern: '^home\\b', enabled: true, note: 'Home 首页标题' },
  { id: 'keyword-welcome', type: 'keyword', pattern: '^welcome to', enabled: true, note: '欢迎页' },
  { id: 'keyword-sign-in', type: 'keyword', pattern: '登录|注册|sign in|sign up', enabled: true, note: '登录/注册页' },
  { id: 'domain-localhost', type: 'domain', pattern: 'localhost', enabled: false, note: '本地地址' },
  { id: 'domain-example', type: 'domain', pattern: 'example.com', enabled: true, note: '示例域名' },
  // 搜索引擎自身页
  { id: 'domain-bing-cache', type: 'domain', pattern: 'cc.bingj.com', enabled: true, note: 'Bing 缓存页' },
  { id: 'domain-bing-search', type: 'domain', pattern: 'bing.com/search', enabled: true, note: 'Bing 搜索页内链' },
];

// ====== 存储 ======

function getConfig(): SearchFilterConfig {
  if (typeof window === 'undefined') return { rules: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { rules: [] };
}

function saveConfig(config: SearchFilterConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** 获取已有的启用规则，若无则写入默认规则并返回 */
export function getEnabledRules(): SearchFilterRule[] {
  const config = getConfig();
  if (config.rules.length === 0) {
    config.rules = DEFAULT_RULES;
    saveConfig(config);
  }
  // 始终合并默认规则中新增的（用户可能更新了应用版本）
  const existingIds = new Set(config.rules.map((r) => r.id));
  for (const def of DEFAULT_RULES) {
    if (!existingIds.has(def.id)) {
      config.rules.push(def);
    }
  }
  saveConfig(config);
  return config.rules.filter((r) => r.enabled);
}

/** 获取所有规则（含已禁用的） */
export function getAllRules(): SearchFilterRule[] {
  const config = getConfig();
  if (config.rules.length === 0) {
    config.rules = DEFAULT_RULES;
    saveConfig(config);
  }
  return config.rules;
}

/** 更新规则列表 */
export function setRules(rules: SearchFilterRule[]): void {
  saveConfig({ rules });
}

/** 重置为默认规则 */
export function resetRules(): void {
  saveConfig({ rules: DEFAULT_RULES });
}

// ====== 过滤函数（服务端/客户端均可使用） ======

export interface FilterableResult {
  title: string;
  url: string;
  snippet?: string;
}

/** 服务端可用的默认规则（不含 localStorage 依赖） */
export const DEFAULT_RULES_SERVER: SearchFilterRule[] = [
  { id: 'server-domain-bingcache', type: 'domain', pattern: 'cc.bingj.com', enabled: true, note: '' },
  { id: 'server-domain-example', type: 'domain', pattern: 'example.com', enabled: true, note: '' },
  { id: 'server-keyword-docs', type: 'keyword', pattern: '^文档\\s', enabled: true, note: '' },
  { id: 'server-keyword-documentation', type: 'keyword', pattern: '^documentation', enabled: true, note: '' },
  { id: 'server-keyword-docs-title', type: 'keyword', pattern: '^docs\\b', enabled: true, note: '' },
  { id: 'server-keyword-index', type: 'keyword', pattern: '^index of', enabled: true, note: '' },
  { id: 'server-keyword-sign', type: 'keyword', pattern: '登录|注册|sign in', enabled: true, note: '' },
];

/**
 * 应用规则过滤搜索结果。
 * 返回 items 中不被任何启用规则匹配的结果。
 */
export function applyFilters(items: FilterableResult[]): FilterableResult[] {
  const rules = getEnabledRules();
  if (rules.length === 0) return items;

  return items.filter((item) => {
    try {
      const u = new URL(item.url);
      const hostname = u.hostname.replace(/^www\./, '');
      const pathname = u.pathname;
      const fullUrl = u.href;
      const title = item.title || '';
      const snippet = item.snippet || '';

      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (rule.type === 'domain') {
          // 域名匹配：支持精确和前缀匹配
          if (hostname === rule.pattern || hostname.endsWith('.' + rule.pattern)) {
            return false;
          }
          // 也匹配 path 中包含的模式（如 bing.com/search）
          if (rule.pattern.includes('/')) {
            const patternHost = rule.pattern.split('/')[0];
            const patternPath = '/' + rule.pattern.split('/').slice(1).join('/');
            if (hostname === patternHost && pathname.startsWith(patternPath)) {
              return false;
            }
          }
        } else if (rule.type === 'keyword') {
          const regex = new RegExp(rule.pattern, 'i');
          if (regex.test(title) || regex.test(snippet)) {
            return false;
          }
        }
      }
      return true;
    } catch {
      return true;
    }
  });
}

/**
 * 服务端专用过滤函数（无需读取 localStorage）。
 * 接收规则列表作为参数。
 */
export function applyFiltersServer(
  items: FilterableResult[],
  rules: SearchFilterRule[],
): FilterableResult[] {
  const enabledRules = rules.filter((r) => r.enabled);
  if (enabledRules.length === 0) return items;

  return items.filter((item) => {
    try {
      const u = new URL(item.url);
      const hostname = u.hostname.replace(/^www\./, '');
      const pathname = u.pathname;
      const title = item.title || '';
      const snippet = item.snippet || '';

      for (const rule of enabledRules) {
        if (rule.type === 'domain') {
          if (hostname === rule.pattern || hostname.endsWith('.' + rule.pattern)) {
            return false;
          }
          if (rule.pattern.includes('/')) {
            const patternHost = rule.pattern.split('/')[0];
            const patternPath = '/' + rule.pattern.split('/').slice(1).join('/');
            if (hostname === patternHost && pathname.startsWith(patternPath)) {
              return false;
            }
          }
        } else if (rule.type === 'keyword') {
          const regex = new RegExp(rule.pattern, 'i');
          if (regex.test(title) || regex.test(snippet)) {
            return false;
          }
        }
      }
      return true;
    } catch {
      return true;
    }
  });
}

/** 从 provider 配置中读取过滤规则（兼容第三方配置存储） */
export function getFilterRulesFromProvider(): SearchFilterRule[] {
  // 先尝试从独立存储读取
  const allRules = getAllRules();
  if (allRules.length > 0) return allRules;
  return DEFAULT_RULES;
}
