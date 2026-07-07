export type ProtocolType = "OpenAI" | "Anthropic" | "Gemini";

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
  /** API 协议类型 */
  protocol: ProtocolType;
  /** 已添加的模型列表 */
  models: string[];
}

export interface PresetProvider {
  id: string;
  name: string;
  baseUrl: string;
  protocol: ProtocolType;
}

export const PRESET_PROVIDERS: PresetProvider[] = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", protocol: "OpenAI" },
  { id: "anthropic", name: "Anthropic", baseUrl: "https://api.anthropic.com", protocol: "Anthropic" },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", protocol: "OpenAI" },
  { id: "moonshot", name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", protocol: "OpenAI" },
  { id: "qwen", name: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", protocol: "OpenAI" },
  { id: "zhipu", name: "智谱AI", baseUrl: "https://open.bigmodel.cn/api/paas/v4", protocol: "OpenAI" },
  { id: "siliconflow", name: "SiliconFlow", baseUrl: "https://api.siliconflow.cn/v1", protocol: "OpenAI" },
  { id: "baidu", name: "文心一言", baseUrl: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop", protocol: "OpenAI" },
  { id: "custom", name: "自定义", baseUrl: "", protocol: "OpenAI" },
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
 * 通过后端代理获取模型列表（绕过 CORS）
 */
export async function fetchModels(
  baseUrl: string,
  apiKey: string,
  protocol: ProtocolType = "OpenAI"
): Promise<string[]> {
  const resp = await fetch("/api/proxy/fetch-models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl, apiKey, protocol }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `请求失败: ${resp.status}`);
  }
  const data = await resp.json();
  return data.models || [];
}

/**
 * 通过后端代理测试连接（绕过 CORS）
 */
export async function testConnection(
  baseUrl: string,
  apiKey: string,
  model: string,
  protocol: ProtocolType = "OpenAI"
): Promise<boolean> {
  try {
    const resp = await fetch("/api/proxy/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, apiKey, model, protocol }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 调用 AI Chat Completion（通过后端代理）
 */
export async function chatCompletion(
  provider: ProviderConfig,
  model: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const resp = await fetch("/api/proxy/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: {
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        protocol: provider.protocol,
      },
      model,
      messages,
    }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `AI 请求失败: ${resp.status}`);
  }
  const data = await resp.json();
  return data.content || "";
}

/**
 * 生成摘要的系统提示词
 */
export function summaryPrompt(content: string): { role: string; content: string }[] {
  return [
    {
      role: "system",
      content:
        "你是一个专业的文章摘要助手。请用中文为以下文章生成简洁的摘要（300字以内），" +
        "提炼核心观点和关键信息。摘要应当独立可读，使用简洁的语言。直接输出摘要内容，不要加多余说明。",
    },
    { role: "user", content },
  ];
}
