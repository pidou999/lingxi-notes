export interface SiteCookie {
  id: string;
  domain: string;
  cookie: string;
  enabled: boolean;
}

const STORAGE_KEY = "ai-notes:site-cookies";

export function getSiteCookies(): SiteCookie[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSiteCookies(cookies: SiteCookie[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cookies));
}

/**
 * 从 URL 中匹配对应的已启用 Cookie
 */
export function getCookieForUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const hostname = u.hostname;
    const cookies = getSiteCookies();
    for (const c of cookies) {
      if (c.enabled && hostname.includes(c.domain)) {
        return c.cookie;
      }
    }
  } catch {
    return null;
  }
  return null;
}
