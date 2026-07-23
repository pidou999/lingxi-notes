import { NextRequest, NextResponse } from "next/server";
import { assertUrlNotSensitive } from "@/lib/ssrf";

const FETCH_TIMEOUT_MS = 30000;

export async function GET() {
  return NextResponse.json({ status: "ok", ready: true });
}

/** 从嵌套的 API 错误 JSON 中递归提取可读字符串 */
function extractApiError(obj: unknown): string {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  if (typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    for (const key of ["message", "error", "msg"]) {
      const val = o[key];
      if (val && typeof val === "string") return val;
      if (val && typeof val === "object") return extractApiError(val);
    }
    if (o.code) return `错误码 ${o.code}`;
  }
  return "";
}

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, apiKey, model, input, probe } = await request.json();

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "缺少 provider 配置" },
        { status: 400 }
      );
    }

    if (!input) {
      return NextResponse.json(
        { error: "缺少 input" },
        { status: 400 }
      );
    }

    // SSRF 防护：baseUrl 为用户配置的向量服务地址。
    // 仅拦截本机 loopback / 云元数据，允许局域网服务（如 192.168.x.x 的 ollama）。
    try {
      await assertUrlNotSensitive(baseUrl);
    } catch {
      return NextResponse.json(
        { error: "非法的服务地址（禁止访问本机/云元数据）" },
        { status: 400 }
      );
    }

    const url = baseUrl.replace(/\/+$/, "") + "/embeddings";
    const embedModel = model || "text-embedding-3-small";
    console.log(`[Embedding Proxy] baseUrl=${baseUrl}, model=${embedModel}, inputLen=${String(input).length}, probe=${!!probe}`);

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: embedModel,
        input,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      // 尝试解析 JSON 格式的错误信息，递归提取 message 或 error
      let detail = text.slice(0, 500);
      try {
        const parsed = JSON.parse(text);
        detail = extractApiError(parsed) || detail;
      } catch { /* 非 JSON，用原始文本 */ }

      // 探测模式：上游返回 404/4xx 属于"模型不可用"，避免前端控制台被 404 淹没
      if (probe) {
        return NextResponse.json({
          embedding: [],
          error: detail,
          upstreamStatus: resp.status,
        });
      }

      return NextResponse.json(
        { error: detail },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json({ embedding: data.data?.[0]?.embedding || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
