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
    const { baseUrl, apiKey, model, protocol = "OpenAI" } = await request.json();

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "缺少 baseUrl 或 apiKey" },
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
          model: model || "claude-3-5-sonnet",
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });
    } else {
      const url = baseUrl.replace(/\/+$/, "") + "/chat/completions";
      resp = await fetchWithOptions(url, {
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
