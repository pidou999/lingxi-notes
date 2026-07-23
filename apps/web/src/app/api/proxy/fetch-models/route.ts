import { NextRequest, NextResponse } from "next/server";
import { assertUrlNotSensitive } from "@/lib/ssrf";

const FETCH_TIMEOUT_MS = 20000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, apiKey, protocol = "OpenAI" } = await request.json();

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "缺少 baseUrl 或 apiKey" },
        { status: 400 }
      );
    }

    let models: string[] = [];

    if (protocol === "Anthropic") {
      const url = "https://api.anthropic.com/v1/models";
      const resp = await fetchWithTimeout(url, {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Anthropic API ${resp.status}: ${text}`);
      }
      const data = await resp.json();
      models = (data.data || []).map((m: any) => m.id || m.name);
    } else {
      // SSRF 防护：仅拦截本机/云元数据，允许局域网模型服务（如 192.168.x.x 的 ollama）。
      // 不再对 SSL 错误自动降级 rejectUnauthorized，避免中间人劫持。
      try {
        await assertUrlNotSensitive(baseUrl);
      } catch {
        return NextResponse.json(
          { error: "非法的服务地址（禁止访问本机/云元数据）" },
          { status: 400 }
        );
      }
      const url = baseUrl.replace(/\/+$/, "") + "/models";
      const resp = await fetchWithTimeout(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`API ${resp.status}: ${text}`);
      }
      const data = await resp.json();
      models = (data.data || []).filter((m: any) => m.id).map((m: any) => m.id);
    }

    return NextResponse.json({ models: models.sort() });
  } catch (err: any) {
    console.error("[fetch-models]", err?.message || err, err?.stack || "");
    return NextResponse.json(
      { error: err?.message || "获取模型失败" },
      { status: 500 }
    );
  }
}
