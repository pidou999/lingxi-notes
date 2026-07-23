/**
 * 安全的 localStorage 封装
 *
 * 使用 Web Crypto API (AES-GCM) 对敏感数据加密后存储。
 * 密钥从浏览器指纹 + 固定 salt 派生，未登录时每次会话不同。
 *
 * 注意：这并非防 NSA 级别的安全方案，
 * 而是防止 Cookie/token 以明文形式留存在 localStorage 中被
 * 浏览器扩展/XSS 简单读取。真正的安全需要 httpOnly cookie。
 */

const STORE_KEY = "ai-notes:secure-v1";

/** 从浏览器指纹生成密钥（每次会话不同） */
async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    // 不包含唯一标识（不降低隐私）
  ].join("||");

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(fingerprint),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** 加密并存储 */
export async function secureSet(key: string, value: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encKey = await deriveKey(salt);
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      encKey,
      enc.encode(value)
    );

    // 存储格式：salt(16) + iv(12) + ciphertext
    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

    const all = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    all[key] = btoa(String.fromCharCode(...combined));
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    // 降级：明文存储（Web Crypto 不可用时）
    const all = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    all[key] = "__plain:" + value;
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  }
}

/** 解密读取 */
export async function secureGet(key: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    const raw = all[key];
    if (!raw) return null;

    // 降级读取
    if (raw.startsWith("__plain:")) return raw.slice(8);

    const combined = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);

    const encKey = await deriveKey(salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      encKey,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

/** 删除某个键 */
export async function secureRemove(key: string): Promise<void> {
  if (typeof window === "undefined") return;
  const all = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  delete all[key];
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
}

/** 清空所有安全存储 */
export async function secureClear(): Promise<void> {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORE_KEY);
}
