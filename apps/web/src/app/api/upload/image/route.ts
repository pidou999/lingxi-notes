import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 500; // uploads 目录文件数上限，防止磁盘耗尽
const RATE_LIMIT = 30; // 每 IP 每分钟最多上传次数
const rateMap = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (rateMap.get(ip) || []).filter((t) => now - t < 60_000);
  if (arr.length >= RATE_LIMIT) {
    rateMap.set(ip, arr);
    return false;
  }
  arr.push(now);
  rateMap.set(ip, arr);
  return true;
}

function sameOrigin(request: NextRequest): boolean {
  const host = request.headers.get("host");
  if (!host) return true;
  const check = (h: string | null) => {
    if (!h) return false;
    try {
      return new URL(h).host === host;
    } catch {
      return false;
    }
  };
  return check(request.headers.get("origin")) || check(request.headers.get("referer"));
}

export async function POST(request: NextRequest) {
  try {
    // 同源校验：阻止跨站 POST 上传
    if (!sameOrigin(request)) {
      return NextResponse.json({ error: "来源不合法" }, { status: 403 });
    }
    // 速率限制：每 IP 每分钟最多 30 次
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "上传过于频繁，请稍后再试" }, { status: 429 });
    }
    // 目录文件数上限：防止磁盘耗尽
    const checkDir = path.join(process.cwd(), "public", "uploads");
    try {
      const files = await readdir(checkDir);
      if (files.length >= MAX_FILES) {
        return NextResponse.json({ error: "上传数量已达上限" }, { status: 507 });
      }
    } catch {
      // 目录不存在时忽略，下方 mkdir 会创建
    }
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "未提供图片文件" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "不支持的图片格式，仅支持 JPG/PNG/GIF/WebP" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "图片大小不能超过 5MB" },
        { status: 400 }
      );
    }

    // Determine extension from mime type
    const extMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
    };
    const ext = extMap[file.type] || ".jpg";

    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const filename = `${crypto.randomBytes(16).toString("hex")}${ext}`;

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    // Write file
    const filepath = path.join(uploadsDir, filename);
    await writeFile(filepath, buffer);

    return NextResponse.json({
      url: `/uploads/${filename}`,
      filename,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "上传失败，请重试" },
      { status: 500 }
    );
  }
}
