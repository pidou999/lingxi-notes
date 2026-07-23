import { NextRequest, NextResponse } from "next/server";
import { assertUrlNotSensitive } from "@/lib/ssrf";

const FETCH_TIMEOUT_MS = 20000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, apiKey, model, protocol = "OpenAI" } = await request.json();

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "缺少 baseUrl 或 apiKey" },
        { status: 400 }
      );
    }

    let resp: Response;

    if (protocol === "Anthropic") {
      resp = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || "claude-3-5-sonnet",
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });
    } else {
      // SSRF 防护：仅拦截本机/云元数据，允许局域网模型服务（如 192.168.x.x 的 ollama）。
      // 不再对 SSL 错误自动降级 rejectUnauthorized，避免中间人劫持。
      try {
        await assertUrlNotSensitive(baseUrl);
      } catch {
        return NextResponse.json(
          { ok: false, error: "非法的服务地址（禁止访问本机/云元数据）" },
          { status: 200 }
        );
      }
      const url = baseUrl.replace(/\/+$/, "") + "/chat/completions";
      resp = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 1,
        }),
      });
    }

    if (resp.ok) {
      return NextResponse.json({ ok: true });
    } else {
      const text = await resp.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `API ${resp.status}: ${text.slice(0, 200)}` },
        { status: 200 }
      );
    }
  } catch (err: any) {
    console.error("[test-connection]", err?.message || err, err?.stack || "");
    return NextResponse.json(
      { ok: false, error: err?.message || "未知错误" },
      { status: 200 }
    );
  }
}
