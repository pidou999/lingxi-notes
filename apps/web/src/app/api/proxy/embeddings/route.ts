import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, apiKey, model, input } = await request.json();

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

    const url = baseUrl.replace(/\/+$/, "") + "/embeddings";

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "text-embedding-ada-002",
        input,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: `Embedding API ${resp.status}: ${text.slice(0, 300)}` },
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
