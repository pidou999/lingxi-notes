import type { ProviderConfig } from "./providers";
import { getProviders } from "./providers";

const EMBEDDINGS_KEY = "ai-notes:embeddings";
const EMBEDDING_MODEL_KEY = "ai-notes:embedding-model";

interface EmbeddingsMap {
  [noteId: string]: number[];
}

function getStoredEmbeddings(): EmbeddingsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EMBEDDINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setStoredEmbeddings(map: EmbeddingsMap): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EMBEDDINGS_KEY, JSON.stringify(map));
}

/** 获取缓存的 embedding 模型名 */
export function getCachedEmbeddingModel(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EMBEDDING_MODEL_KEY);
}

/** 设置缓存的 embedding 模型名 */
export function setCachedEmbeddingModel(model: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EMBEDDING_MODEL_KEY, model);
}

/** 清除所有缓存的 embedding（换模型时调用） */
export function clearEmbeddings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(EMBEDDINGS_KEY);
  localStorage.removeItem(EMBEDDING_MODEL_KEY);
}

/** 获取第一个支持 Embedding 的 provider */
export function getEmbeddingProvider(): ProviderConfig | null {
  const providers = getProviders();
  for (const p of providers) {
    if (p.protocol === "OpenAI" && p.baseUrl && p.apiKey) {
      return p;
    }
  }
  return null;
}

/** 生成单个文本的 embedding */
export async function generateEmbedding(
  text: string,
  provider: ProviderConfig,
  model?: string
): Promise<number[]> {
  const embedModel = model || provider.embeddingModel || "text-embedding-ada-002";
  const resp = await fetch("/api/proxy/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: embedModel,
      input: text,
    }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `请求失败: ${resp.status}`);
  }
  const data = await resp.json();
  return data.embedding || [];
}

/** 确保所有笔记都有 embedding（增量生成） */
export async function ensureAllEmbeddings(
  notes: { id: string; title: string; html: string }[],
  provider: ProviderConfig,
  model?: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const map = getStoredEmbeddings();
  const embedModel = model || provider.embeddingModel || "text-embedding-ada-002";
  let changed = false;
  let done = 0;
  const total = notes.length;

  for (const note of notes) {
    if (map[note.id]) {
      done++;
      continue;
    }
    try {
      // 用标题+内容生成 embedding
      const text = `${note.title}\n${note.html?.replace(/<[^>]*>/g, "").slice(0, 2000) || ""}`;
      map[note.id] = await generateEmbedding(text, provider, embedModel);
      changed = true;
      done++;
      onProgress?.(done, total);
      // 每生成一个保存一次，避免丢失
      if (changed) setStoredEmbeddings(map);
    } catch {
      done++;
      // 个别失败跳过
    }
  }

  if (changed) {
    setStoredEmbeddings(map);
    setCachedEmbeddingModel(embedModel);
  }
}

/** 对查询文本进行向量搜索，返回相似度最高的笔记 ID 列表 */
export async function searchByVector(
  query: string,
  provider: ProviderConfig,
  model?: string,
  limit: number = 10
): Promise<{ noteId: string; score: number }[]> {
  // 1. 为查询生成 embedding
  const queryVector = await generateEmbedding(query, provider, model);
  if (!queryVector || queryVector.length === 0) return [];

  // 2. 获取所有缓存的 embeddings
  const map = getStoredEmbeddings();
  const entries = Object.entries(map);
  if (entries.length === 0) return [];

  // 3. 计算余弦相似度
  const results: { noteId: string; score: number }[] = [];

  for (const [noteId, vector] of entries) {
    const score = cosineSimilarity(queryVector, vector);
    results.push({ noteId, score });
  }

  // 4. 按相似度倒序排列
  results.sort((a, b) => b.score - a.score);
  // 5. 只返回不在黑名单中的结果
  return results.slice(0, limit).filter((r) => isFinite(r.score) && r.score > 0);
}

/** 余弦相似度 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
