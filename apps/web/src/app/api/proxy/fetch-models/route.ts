import { NextRequest, NextResponse } from "next/server";

/**
 * 使用 node:https 发起请求（支持关闭 SSL 验证）
 */
async function fetchWithOptions(
  url: string,
  options: RequestInit & { rejectUnauthorized?: boolean } = {}
): Promise<Response> {
  const { rejectUnauthorized, ...fetchOpts } = options;

  // 默认全局 fetch，遇到 SSL 错误时改用 https.request + 选项绕过
  try {
    const resp = await fetch(url, fetchOpts);
    return resp;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // 如果是 SSL 相关的错误，尝试用 https.Agent 绕过
    if (
      rejectUnauthorized !== false &&
      (msg.includes("certificate") ||
        msg.includes("SSL") ||
        msg.includes("self-signed") ||
        msg.includes("UNABLE_TO_VERIFY"))
    ) {
      const https = await import("https");
      const customAgent = new https.Agent({ rejectUnauthorized: false });
      return fetch(url, { ...fetchOpts, agent: customAgent } as any);
    }
    throw err;
  }
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
      const resp = await fetchWithOptions(url, {
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
      // OpenAI 兼容协议
      const url = baseUrl.replace(/\/+$/, "") + "/models";
      const resp = await fetchWithOptions(url, {
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
    // 在服务端打印详细错误
    console.error("[fetch-models]", err?.message || err, err?.stack || "");
    return NextResponse.json(
      { error: err?.message || "获取模型失败" },
      { status: 500 }
    );
  }
}
