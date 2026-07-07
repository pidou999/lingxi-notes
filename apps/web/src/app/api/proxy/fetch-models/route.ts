import { NextRequest, NextResponse } from "next/server";

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
      // Anthropic: 使用 x-api-key header，端点格式不同
      const url = "https://api.anthropic.com/v1/models";
      const resp = await fetch(url, {
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
      const resp = await fetch(url, {
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
      models = (data.data || [])
        .filter((m: any) => m.id)
        .map((m: any) => m.id);
    }

    return NextResponse.json({ models: models.sort() });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "未知错误" },
      { status: 500 }
    );
  }
}
