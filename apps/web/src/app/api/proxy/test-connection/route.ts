import { NextRequest, NextResponse } from "next/server";

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
      // Anthropic messages endpoint
      resp = await fetch("https://api.anthropic.com/v1/messages", {
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
      // OpenAI 兼容协议
      const url = baseUrl.replace(/\/+$/, "") + "/chat/completions";
      resp = await fetch(url, {
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
        { ok: false, error: `API ${resp.status}: ${text}` },
        { status: 200 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "未知错误" },
      { status: 200 }
    );
  }
}
