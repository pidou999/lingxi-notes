export interface ProviderConfig {
  id: string;
  /** 预设服务商 id (如 'openai', 'custom' 表示自定义) */
  type: string;
  /** 显示名称 */
  name: string;
  /** API 地址 */
  baseUrl: string;
  /** API Key */
  apiKey: string;
  /** 已添加的模型列表 */
  models: string[];
}

export interface PresetProvider {
  id: string;
  name: string;
  baseUrl: string;
}

export const PRESET_PROVIDERS: PresetProvider[] = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", name: "Anthropic", baseUrl: "https://api.anthropic.com" },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { id: "moonshot", name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1" },
  { id: "qwen", name: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { id: "zhipu", name: "智谱AI", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  { id: "siliconflow", name: "SiliconFlow", baseUrl: "https://api.siliconflow.cn/v1" },
  { id: "baidu", name: "文心一言", baseUrl: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop" },
  { id: "custom", name: "自定义", baseUrl: "" },
];

const STORAGE_KEY = "ai-notes:providers";

export function getProviders(): ProviderConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProviders(providers: ProviderConfig[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
}

export function getPresetProvider(id: string): PresetProvider | undefined {
  return PRESET_PROVIDERS.find((p) => p.id === id);
}

/**
 * 通过 API 获取模型列表（兼容 OpenAI API 格式）
 */
export async function fetchModels(
  baseUrl: string,
  apiKey: string
): Promise<string[]> {
  const url = baseUrl.replace(/\/+$/, "") + "/models";
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!resp.ok) throw new Error(`API 请求失败: ${resp.status}`);
  const data = await resp.json();
  const models: string[] = (data.data || [])
    .filter((m: any) => m.id && m.object === "model" || m.id)
    .map((m: any) => m.id);
  return models.sort();
}

/**
 * 测试连接（发送一个简单的 chat completion 请求）
 */
export async function testConnection(
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<boolean> {
  try {
    const url = baseUrl.replace(/\/+$/, "") + "/chat/completions";
    const resp = await fetch(url, {
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
    return resp.ok;
  } catch {
    return false;
  }
}
