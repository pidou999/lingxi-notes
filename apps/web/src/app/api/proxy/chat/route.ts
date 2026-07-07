import { NextRequest, NextResponse } from "next/server";

async function fetchWithOptions(
  url: string,
  options: RequestInit & { rejectUnauthorized?: boolean } = {}
): Promise<Response> {
  const { rejectUnauthorized, ...fetchOpts } = options;
  try {
    return await fetch(url, fetchOpts);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
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
    const { provider, model, messages } = await request.json();
    const { baseUrl, apiKey, protocol = "OpenAI" } = provider || {};

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "缺少 provider 配置" },
        { status: 400 }
      );
    }

    if (!model || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "缺少 model 或 messages" },
        { status: 400 }
      );
    }

    let resp: Response;

    if (protocol === "Anthropic") {
      resp = await fetchWithOptions("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages,
        }),
      });
    } else {
      // OpenAI 兼容协议
      const url = baseUrl.replace(/\/+$/, "") + "/chat/completions";
      resp = await fetchWithOptions(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 4096,
        }),
      });
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`API ${resp.status}: ${text.slice(0, 300)}`);
    }

    // 先读文本，再从中提取 JSON（部分 API 返回时带额外换行/空白/流式残留）
    const raw = await resp.text();
    let data: any;
    try {
      // 尝试直接解析
      data = JSON.parse(raw);
    } catch {
      // 解析失败：尝试找到第一个 { 到最后一个 } 之间的内容
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start !== -1 && end > start) {
        data = JSON.parse(raw.slice(start, end + 1));
      } else {
        throw new Error(`响应不是有效 JSON: ${raw.slice(0, 200)}`);
      }
    }

    let content = "";
    if (protocol === "Anthropic") {
      content = data.content?.[0]?.text || "";
    } else {
      content = data.choices?.[0]?.message?.content || "";
    }

    return NextResponse.json({ content });
  } catch (err: any) {
    console.error("[chat]", err?.message || err, err?.stack || "");
    return NextResponse.json(
      { error: err?.message || "调用 AI 失败" },
      { status: 500 }
    );
  }
}
