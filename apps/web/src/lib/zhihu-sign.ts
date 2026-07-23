/**
 * zhihu-sign.ts - Pure TypeScript x-zse-96 Signature Generator
 *
 * Ported from signature.py (yuchenzhu-research/zhihu-scraper),
 * which was ported from z_core.js (Zhihu's own signing code).
 *
 * Generates x-zse-96 signatures for Zhihu API requests.
 * Uses SM4-like encryption with constant keys (ZK) and S-Box (ZB).
 */

import { createHash } from "crypto";

// SM4-like CK (Constant Keys) constant array
const ZK = [
  1170614578, 1024848638, 1413669199, 3951632832, 3528873006, 2921909214,
  4151847688, 3997739139, 1933479194, 3323781115, 3888513386, 460404854,
  3747539722, 2403641034, 2615871395, 2119585428, 2265697227, 2035090028,
  2773447226, 4289380121, 4217216195, 2200601443, 3051914490, 1579901135,
  1321810770, 456816404, 2903323407, 4065664991, 330002838, 3506006750,
  363569021, 2347096187,
];

// S-Box for linear substitution
const ZB = [
  20, 223, 245, 7, 248, 2, 194, 209, 87, 6, 227, 253, 240, 128, 222, 91,
  237, 9, 125, 157, 230, 93, 252, 205, 90, 79, 144, 199, 159, 197, 186, 167,
  39, 37, 156, 198, 38, 42, 43, 168, 217, 153, 15, 103, 80, 189, 71, 191,
  97, 84, 247, 95, 36, 69, 14, 35, 12, 171, 28, 114, 178, 148, 86, 182,
  32, 83, 158, 109, 22, 255, 94, 238, 151, 85, 77, 124, 254, 18, 4, 26,
  123, 176, 232, 193, 131, 172, 143, 142, 150, 30, 10, 146, 162, 62, 224, 218,
  196, 229, 1, 192, 213, 27, 110, 56, 231, 180, 138, 107, 242, 187, 54, 120,
  19, 44, 117, 228, 215, 203, 53, 239, 251, 127, 81, 11, 133, 96, 204, 132,
  41, 115, 73, 55, 249, 147, 102, 48, 122, 145, 106, 118, 74, 190, 29, 16,
  174, 5, 177, 129, 63, 113, 99, 31, 161, 76, 246, 34, 211, 13, 60, 68,
  207, 160, 65, 111, 82, 165, 67, 169, 225, 57, 112, 244, 155, 51, 236, 200,
  233, 58, 61, 47, 100, 137, 185, 64, 17, 70, 234, 163, 219, 108, 170, 166,
  59, 149, 52, 105, 24, 212, 78, 173, 45, 0, 116, 226, 119, 136, 206, 135,
  175, 195, 25, 92, 121, 208, 126, 139, 3, 75, 141, 21, 130, 98, 241, 40,
  154, 66, 184, 49, 181, 46, 243, 88, 101, 183, 8, 23, 72, 188, 104, 179,
  210, 134, 250, 201, 164, 89, 216, 202, 220, 50, 221, 152, 140, 33, 235, 214,
];

/** Cyclic left shift on 32-bit unsigned integer */
function cyclicShift(e: number, t: number): number {
  e &= 0xffffffff;
  return (((e << t) & 0xffffffff) | (e >>> (32 - t))) >>> 0;
}

/** Unpack a 32-bit integer into 4 bytes in a byte list */
function packInt(e: number, t: number[], n: number): void {
  e &= 0xffffffff;
  t[n] = (e >>> 24) & 0xff;
  t[n + 1] = (e >>> 16) & 0xff;
  t[n + 2] = (e >>> 8) & 0xff;
  t[n + 3] = e & 0xff;
}

/** Pack 4 bytes from a list into a 32-bit integer */
function unpackInt(e: number[], t: number): number {
  return ((e[t] << 24) | (e[t + 1] << 16) | (e[t + 2] << 8) | e[t + 3]) >>> 0;
}

/** Linear substitution function */
function G(e: number): number {
  const t0 = (e >>> 24) & 0xff;
  const t1 = (e >>> 16) & 0xff;
  const t2 = (e >>> 8) & 0xff;
  const t3 = e & 0xff;

  const n0 = ZB[t0];
  const n1 = ZB[t1];
  const n2 = ZB[t2];
  const n3 = ZB[t3];

  const r = ((n0 << 24) | (n1 << 16) | (n2 << 8) | n3) >>> 0;
  return (r ^ cyclicShift(r, 2) ^ cyclicShift(r, 10) ^ cyclicShift(r, 18) ^ cyclicShift(r, 24)) >>> 0;
}

/** SM4-like 16-byte block encryption logic */
function encryptBlock(e: number[]): number[] {
  const n: number[] = new Array(36).fill(0);
  n[0] = unpackInt(e, 0);
  n[1] = unpackInt(e, 4);
  n[2] = unpackInt(e, 8);
  n[3] = unpackInt(e, 12);

  for (let r = 0; r < 32; r++) {
    const xorVal = (n[r + 1] ^ n[r + 2] ^ n[r + 3] ^ ZK[r]) >>> 0;
    const o = G(xorVal);
    n[r + 4] = (n[r] ^ o) >>> 0;
  }

  const t: number[] = new Array(16).fill(0);
  packInt(n[35], t, 0);
  packInt(n[34], t, 4);
  packInt(n[33], t, 8);
  packInt(n[32], t, 12);
  return t;
}

/** Encrypt 32 bytes (offset 16-48) with dynamic keys */
function encryptOffset(e: number[], t: number[]): number[] {
  const n: number[] = [];
  let length = e.length;
  let i = 0;
  while (length > 0) {
    const o = e.slice(16 * i, 16 * (i + 1));
    const a: number[] = new Array(16).fill(0);
    for (let c = 0; c < 16; c++) {
      a[c] = o[c] ^ t[c];
    }
    t = encryptBlock(a);
    n.push(...t);
    i++;
    length -= 16;
  }
  return n;
}

/** Pre-process first 16 bytes and encrypt */
function encodeFirst16(array0_16: number[]): number[] {
  const result: number[] = [];
  const arrayOffset = [48, 53, 57, 48, 53, 51, 102, 55, 100, 49, 53, 101, 48, 49, 100, 55];
  for (let idx = 0; idx < array0_16.length; idx++) {
    const a = array0_16[idx] ^ arrayOffset[idx];
    const b = a ^ 42;
    result.push(b);
  }
  return encryptBlock(result);
}

/** Transform 3 bytes (24-bit) into 4 x 6-bit numbers */
function encodeTriplet(ar: number[]): number[] {
  const b = ar[1] << 8;
  const c = ar[0] | b;
  const d = ar[2] << 16;
  const e = c | d;

  const resultArray: number[] = [];
  resultArray.push(e & 63);
  let x6 = 6;
  while (resultArray.length < 4) {
    const a = e >>> x6;
    resultArray.push(a & 63);
    x6 += 6;
  }
  return resultArray;
}

/** Build the initial 48-byte buffer and encrypt it */
function getInitArray(encodeMd5: string, seedByte?: number): number[] {
  const initArray: number[] = [];
  for (let i = 0; i < encodeMd5.length; i++) {
    initArray.push(encodeMd5.charCodeAt(i));
  }
  initArray.unshift(0);

  // Random seed byte (or deterministic for testing)
  const sb = seedByte ?? Math.floor(Math.random() * 127);
  initArray.unshift(sb);

  while (initArray.length < 48) {
    initArray.push(14);
  }

  const array0_16 = encodeFirst16(initArray.slice(0, 16));
  const array16_48 = encryptOffset(initArray.slice(16, 48), array0_16);
  return array0_16.concat(array16_48);
}

/** Generate final x-zse-96 signature from MD5 hash string */
export function getZse96(encodeMd5: string, seedByte?: number): string {
  const initArray = getInitArray(encodeMd5, seedByte);

  for (let i = 47; i >= 0; i -= 4) {
    initArray[i] ^= 58;
  }
  initArray.reverse();

  const resultArray: number[] = [];
  for (let j = 3; j <= initArray.length; j += 3) {
    const ar = initArray.slice(j - 3, j);
    resultArray.push(...encodeTriplet(ar));
  }

  const initStr = "6fpLRqJO8M/c3jnYxFkUVC4ZIG12SiH=5v0mXDazWBTsuw7QetbKdoPyAl+hN9rgE";
  let result = "";
  for (const val of resultArray) {
    result += initStr[val];
  }
  return "2.0_" + result;
}

// ====== Public API ======

/** Default x-zst-81 device fingerprint string (version 3) */
const DEFAULT_X_ZST_81 =
  "3_2.0aR_sn77yn6O92wOB8hPZnQr0EMYxc4f18wNBUgpTQ6nxERFZfTY0-4Lm-h3_tufIwJS8gcxTgJS_" +
  "AuPZNcXCTwxI78YxEM20s4PGDwN8gGcYAupMWufIoLVqr4gxrRPOI0cY7HL8qun9g93mFukyigcmebS_Fw" +
  "OYPRP0E4rZUrN9DDom3hnynAUMnAVPF_PhaueTFH9fQL39OCCqYTxfb0rfi9wfPhSM6vxGDJo_rBHpQGNmB" +
  "BLqPJHK2_w8C9eTVMO9Z9NOrMtfhGH_DgpM-BNM1DOxScLG3gg1Hre1FCXKQcXKkrSL1r9GWDXMk8wqBLNm" +
  "bRH96BtOFqVZ7UYG3gC8D9cMS7Y9UrHLVCLZPJO8_CL_6GNCOg_zhJS8PbXmGTcBpgxfkieOPhNfthtf2gC" +
  "_qD3YOce8nCwG2uwBOqeMoML9NBC1xb9yk6SuJhHLK7SM6LVfCve_3vLKlqcL6TxL_UosDvHLxrHmWgxBQ8Xs";

/** API version string for x-zse-93 header */
const API_VERSION = "101_3_3.0";

/**
 * Generate the signed headers needed for Zhihu API requests.
 *
 * @param urlPath - The API path, e.g. "/api/v4/articles/701828765"
 * @param d_c0 - The d_c0 cookie value from a Zhihu warmup request
 * @returns Object with x-zse-93, x-zse-96, x-zst-81 headers
 */
export function signZhihuRequest(urlPath: string, d_c0: string): {
  "x-zse-93": string;
  "x-zse-96": string;
  "x-zst-81": string;
} {
  const md5Input = `${API_VERSION}+${urlPath}+${d_c0}+${DEFAULT_X_ZST_81}`;

  // MD5 hash using Node.js crypto
  const md5Hash = createHash("md5").update(md5Input).digest("hex");

  const xZse96 = getZse96(md5Hash);

  return {
    "x-zse-93": API_VERSION,
    "x-zse-96": xZse96,
    "x-zst-81": DEFAULT_X_ZST_81,
  };
}

/**
 * Perform a Zhihu warmup request to obtain d_c0 and other cookies.
 * Must be called before any article/question API request.
 *
 * @returns Cookie string including d_c0
 */
export async function warmupZhihu(): Promise<string> {
  const resp = await fetch("https://zhuanlan.zhihu.com/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "text/html",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    throw new Error(`Zhihu warmup failed: ${resp.status}`);
  }

  // Extract cookies from set-cookie headers
  const setCookies = resp.headers.getSetCookie?.() || [];
  const cookies = setCookies.map((c: string) => c.split(";")[0]).join("; ");

  // Verify d_c0 is present
  if (!cookies.includes("d_c0=")) {
    throw new Error("Zhihu warmup did not return d_c0 cookie");
  }

  return cookies;
}

/**
 * Extract d_c0 value from a cookie string.
 */
export function extractDc0(cookies: string): string {
  const match = cookies.match(/d_c0=([^;]+)/);
  return match ? match[1] : "";
}
