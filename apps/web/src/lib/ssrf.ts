/**
 * SSRF 防护集中定义。
 *
 * 两套语义：
 * 1) 严格（assertUrlNotPrivate）：禁止一切内网/保留地址（含 192.168/10/172.16、
 *    loopback、link-local、云元数据）。用于抓取「用户粘贴的任意外网网页」类场景
 *    （fetchAndExtract / 图片下载 / 浏览器兜底）。
 * 2) 宽松（assertUrlNotSensitive）：仅禁止本机 loopback 与 link-local/云元数据，
 *    允许 RFC1918 / ULA 局域网地址（如 192.168.x.x 的 ollama）。用于「用户自行
 *    配置的 AI 服务商」类场景（proxy/models、embeddings、chat、Go 代理）。
 *
 * 两者都对域名做 DNS 二次校验，拦截「域名 → 内网 IP」的 DNS 重绑定绕过。
 */
import dns from "dns";

/**
 * 判断主机名是否指向内网/保留地址（IP 字面量）。
 * 覆盖 localhost、127/8、10/8、172.16/12、192.168/16、169.254/16（含云元数据）、
 * 0.0.0.0、::1、fc00::/7、fe80::/10 等。
 */
export function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  const bare = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  if (bare === "::1" || bare === "::" || bare === "0.0.0.0") return true;
  if (bare.startsWith("fc") || bare.startsWith("fd")) return true;
  if (
    bare.startsWith("fe8") || bare.startsWith("fe9") || bare.startsWith("fea") ||
    bare.startsWith("feb") || bare.startsWith("fec") || bare.startsWith("fed")
  ) return true;
  const m = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  return false;
}

/** 仅拦截本机 loopback 与 link-local/云元数据（允许 RFC1918 / ULA 局域网）。 */
function isSensitiveHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  const bare = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  if (bare === "::1" || bare === "127.0.0.1" || bare === "0.0.0.0") return true;
  if (bare.startsWith("fe8") || bare.startsWith("fe9") || bare.startsWith("fea") || bare.startsWith("feb")) return true;
  const m = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

/** 判断完整 URL 是否应被拒绝：非 http(s)、解析失败、或主机指向内网/保留地址。 */
export function isPrivateUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return true;
    return isPrivateHostname(u.hostname);
  } catch {
    return true;
  }
}

/**
 * 异步严格校验：在 isPrivateUrl 基础上对域名做 DNS 解析后二次校验。
 * DNS 解析失败时放行（避免误杀正常域名）。
 */
export async function assertUrlNotPrivate(url: string): Promise<void> {
  if (isPrivateUrl(url)) throw new Error("禁止访问内网/保留地址");
  try {
    const hostname = new URL(url).hostname;
    const { address } = await dns.promises.lookup(hostname);
    if (isPrivateHostname(address)) throw new Error("禁止访问内网/保留地址");
  } catch (e) {
    if (e instanceof Error && e.message.includes("禁止")) throw e;
  }
}

/**
 * 仅拦截最敏感的内部地址：loopback（127/8、::1）与云元数据（169.254.169.254），
 * 允许局域网 AI 服务（如 192.168.x.x 的 ollama）。用于用户自行配置的 provider。
 */
export function isSensitiveInternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return true;
    const h = u.hostname.toLowerCase().trim();
    if (h === "localhost" || h.endsWith(".localhost")) return true;
    const bare = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
    if (bare === "::1" || bare === "127.0.0.1" || bare === "0.0.0.0") return true;
    const m = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
      const a = +m[1], b = +m[2];
      if (a === 127) return true;
      if (a === 169 && b === 254) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * 异步宽松校验（DNS 二次校验版）：仅拦截 loopback / link-local / 云元数据，
 * 允许局域网地址。用于用户配置的 AI provider 基址。
 */
export async function assertUrlNotSensitive(url: string): Promise<void> {
  if (isSensitiveInternalUrl(url)) throw new Error("禁止访问本机/内网保留地址");
  try {
    const hostname = new URL(url).hostname;
    const { address } = await dns.promises.lookup(hostname);
    if (isSensitiveHostname(address)) throw new Error("禁止访问本机/内网保留地址");
  } catch (e) {
    if (e instanceof Error && e.message.includes("禁止")) throw e;
  }
}
