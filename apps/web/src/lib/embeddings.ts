/**
 * Embedding 管理
 *
 * 使用 IndexedDB（embedding-store.ts）替代 localStorage 存取向量数据，
 * 解决 5MB 配额和同步阻塞问题。对外暴露与之前一致的 API 接口。
 */
import type { ProviderConfig } from './providers';
import { getProviders, PRESET_PROVIDERS, fetchModels } from './providers';
import {
  getCachedEmbeddingModel,
  setCachedEmbeddingModel,
  putEmbedding,
  getAllEmbeddings,
  getAllEmbeddingIds,
  clearAllEmbeddings,
  searchVectors,
  countEmbeddings,
  type EmbeddingRecord,
} from './embedding-store';

/** 从任意嵌套的 JSON 错误对象中提取可读字符串 */
function extractErrorMsg(obj: unknown): string {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (obj instanceof Error) return obj.message;
  if (typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    for (const key of ['message', 'error', 'msg']) {
      const val = o[key];
      if (val && typeof val === 'string') return val;
      if (val && typeof val === 'object') return extractErrorMsg(val);
    }
    if (o.code) {
      let parts = [`错误码 ${o.code}`];
      for (const val of Object.values(o)) {
        if (val && typeof val === 'object') {
          const nested = extractErrorMsg(val);
          if (nested && !nested.startsWith('{')) {
            parts.push(nested);
            break;
          }
        }
      }
      return parts.join(' ');
    }
    try {
      const s = JSON.stringify(obj);
      return s.length > 200 ? s.slice(0, 200) + '...' : s;
    } catch {
      return String(obj);
    }
  }
  return String(obj);
}

// ====== 模型缓存（仍使用 localStorage 存模型名，不占空间） ======

/** 获取缓存的 embedding 模型名 */
export { getCachedEmbeddingModel };

/** 清除所有缓存的 embedding（换模型时调用） */
export async function clearEmbeddings(): Promise<void> {
  await clearAllEmbeddings();
}

/** 获取第一个支持 Embedding 的 provider */
export function getEmbeddingProvider(): ProviderConfig | null {
  const providers = getProviders();
  for (const p of providers) {
    if (p.protocol === 'OpenAI' && p.baseUrl && p.apiKey) {
      return p;
    }
  }
  return null;
}

/** 根据 provider 配置获取应使用的 embedding 模型名 */
export function getEmbeddingModelName(provider: ProviderConfig): string {
  if (provider.embeddingModel) return provider.embeddingModel;
  const preset = PRESET_PROVIDERS.find((p) => p.id === provider.type);
  if (preset?.embeddingModel) return preset.embeddingModel;
  return '';
}

// ====== 模型探测（不变） ======

const EMBEDDING_KEYWORDS = ['embed', 'bge', 'e5', 'gte', 'jina', 'cohere'];
const CHAT_MODEL_KEYWORDS = ['chat', 'gpt', 'claude', 'deepseek', 'qwen', 'llama', 'glm', 'yi-', 'mistral', 'gemini', 'codestral'];
const COMMON_EMBEDDING_MODELS = [
  'text-embedding-3-small',
  'text-embedding-3-large',
  'text-embedding-ada-002',
  'text-embedding-v3',
  'text-embedding-v2',
  'embedding-3',
  'BAAI/bge-large-zh-v1.5',
  'BAAI/bge-m3',
  'BAAI/bge-large-en-v1.5',
  'BAAI/bge-small-zh-v1.5',
  'nomic-embed-text',
  'mxbai-embed-large',
  'snowflake-arctic-embed-l',
  'e5-large-v2',
  'gte-Qwen2-7B-instruct',
  'nova-embedding-v1',
];

async function testEmbeddingModel(provider: ProviderConfig, model: string): Promise<boolean> {
  try {
    const resp = await fetch('/api/proxy/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model,
        input: 'test',
        probe: true,
      }),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      if (data.embedding && data.embedding.length > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function detectEmbeddingModel(provider: ProviderConfig): Promise<string | null> {
  let apiModels: string[] = [];
  try {
    apiModels = await fetchModels(provider.baseUrl, provider.apiKey, provider.protocol);
    console.log('[embeddings] /models 返回', apiModels.length, '个模型');
    const matched = apiModels.find((m) =>
      EMBEDDING_KEYWORDS.some((kw) => m.toLowerCase().includes(kw)),
    );
    if (matched) {
      console.log('[embeddings] 关键词匹配到 embedding 模型:', matched);
      return matched;
    }
  } catch (err) {
    console.log('[embeddings] /models 接口失败:', err);
  }

  console.log('[embeddings] 逐个探测常见 embedding 模型...');
  for (const model of COMMON_EMBEDDING_MODELS) {
    const ok = await testEmbeddingModel(provider, model);
    if (ok) {
      console.log('[embeddings] 常见模型探测成功:', model);
      return model;
    }
  }

  if (apiModels.length > 0) {
    console.log('[embeddings] 从 /models 列表逐个探测，共', apiModels.length, '个...');
    const sorted = [...apiModels].sort((a, b) => {
      const aScore = CHAT_MODEL_KEYWORDS.some((k) => a.toLowerCase().includes(k)) ? 1 : 0;
      const bScore = CHAT_MODEL_KEYWORDS.some((k) => b.toLowerCase().includes(k)) ? 1 : 0;
      return aScore - bScore;
    });
    for (const model of sorted) {
      if (model.length > 80) continue;
      const ok = await testEmbeddingModel(provider, model);
      if (ok) {
        console.log('[embeddings] 从模型列表探测成功:', model);
        return model;
      }
    }
  }

  console.log('[embeddings] 所有模型均不可用');
  return null;
}

export async function getApiModelList(provider: ProviderConfig): Promise<string[]> {
  try {
    return await fetchModels(provider.baseUrl, provider.apiKey, provider.protocol);
  } catch {
    return [];
  }
}

export async function warmUpApiRoute(): Promise<boolean> {
  try {
    const resp = await fetch('/api/proxy/embeddings', { method: 'GET' });
    return resp.status === 200;
  } catch {
    return false;
  }
}

// ====== 生成单条 ======

export async function generateEmbedding(
  text: string,
  provider: ProviderConfig,
  model?: string,
): Promise<number[]> {
  const embedModel = model || getEmbeddingModelName(provider);
  const resp = await fetch('/api/proxy/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: embedModel,
      input: text,
    }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    const errMsg = extractErrorMsg(data) || `Embedding 请求失败 (${resp.status})`;
    throw new Error(errMsg);
  }

  const data = await resp.json();
  return data.embedding || [];
}

// ====== 批量生成（增量） ======

export async function ensureAllEmbeddings(
  notes: { id: string; title: string; html: string }[],
  provider: ProviderConfig,
  model?: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const embedModel = model || getEmbeddingModelName(provider);

  // 获取已有 ID 集合，避免重复生成
  const existingIds = new Set(await getAllEmbeddingIds());
  const pending = notes.filter((n) => !existingIds.has(n.id));
  let done = existingIds.size;
  const total = notes.length;

  // 分批并发（默认 4），避免大库全串行过慢；单条失败计入失败列表后继续，
  // 不让一条坏笔记中断整个向量库生成。
  const CONCURRENCY = 4;
  const failed: { id: string; error: string }[] = [];

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (note) => {
        try {
          const text = `${note.title}\n${note.html?.replace(/<[^>]*>/g, '').slice(0, 2000) || ''}`;
          const vector = await generateEmbedding(text, provider, embedModel);
          await putEmbedding({
            id: note.id,
            model: embedModel,
            vector,
            updatedAt: Date.now(),
          });
          return { ok: true as const, id: note.id };
        } catch (err) {
          return { ok: false as const, id: note.id, error: extractErrorMsg(err) };
        }
      })
    );
    for (const r of results) {
      done++;
      if (!r.ok) failed.push({ id: r.id, error: r.error });
      onProgress?.(done, total);
    }
  }

  // 更新缓存模型名
  setCachedEmbeddingModel(embedModel);

  if (failed.length > 0) {
    const first = failed[0];
    throw new Error(
      `有 ${failed.length} 条笔记生成失败（如 ${first.id}：${first.error}）。其余已生成，请检查 API 配置。`
    );
  }
}

// ====== 向量搜索 ======

export async function searchByVector(
  query: string,
  provider: ProviderConfig,
  model?: string,
  limit: number = 10,
): Promise<{ noteId: string; score: number }[]> {
  const embedModel = model || getEmbeddingModelName(provider);
  const queryVector = await generateEmbedding(query, provider, embedModel);
  if (!queryVector || queryVector.length === 0) return [];

  const results = await searchVectors(queryVector, limit);
  return results.map((r) => ({ noteId: r.id, score: r.score }));
}

// ====== 状态查询 ======

/** 获取 embedding 向量总数 */
export async function getEmbeddingCount(): Promise<number> {
  return countEmbeddings();
}
