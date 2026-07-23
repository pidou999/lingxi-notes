/**
 * Embedding 向量存储 — IndexedDB 实现
 *
 * 替代 localStorage 方案，解决 5MB 配额限制和同步阻塞问题。
 *
 * 数据库设计：
 * - 数据库名: ai-notes-embeddings
 * - 对象存储: embeddings
 *   - keyPath: id (noteId)
 *   - 字段: id, model, vector, updatedAt
 * - 索引: model（可按模型过滤）
 */
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'ai-notes-embeddings';
const DB_VERSION = 1;
const STORE_NAME = 'embeddings';

const EMBEDDING_MODEL_KEY = 'ai-notes:embedding-model';

export interface EmbeddingRecord {
  id: string; // noteId
  model: string;
  vector: number[];
  updatedAt: number; // timestamp
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('model', 'model', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

// ====== 缓存的 embedding 模型名 ======

export function getCachedEmbeddingModel(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(EMBEDDING_MODEL_KEY);
}

export function setCachedEmbeddingModel(model: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(EMBEDDING_MODEL_KEY, model);
}

export function clearCachedModel(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(EMBEDDING_MODEL_KEY);
}

// ====== CRUD ======

/** 批量写入/覆盖 embedding 记录 */
export async function putEmbeddings(records: EmbeddingRecord[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all(records.map((r) => tx.store.put(r)));
  await tx.done;
}

/** 写入单条记录 */
export async function putEmbedding(record: EmbeddingRecord): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, record);
}

/** 获取单条记录 */
export async function getEmbedding(id: string): Promise<EmbeddingRecord | undefined> {
  const db = await getDb();
  return db.get(STORE_NAME, id);
}

/** 获取所有记录 */
export async function getAllEmbeddings(): Promise<EmbeddingRecord[]> {
  const db = await getDb();
  return db.getAll(STORE_NAME);
}

/** 获取所有记录的 ID 列表（轻量，不加载 vector） */
export async function getAllEmbeddingIds(): Promise<string[]> {
  const db = await getDb();
  const keys = await db.getAllKeys(STORE_NAME);
  return keys as string[];
}

/** 删除单条记录 */
export async function deleteEmbedding(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}

/** 删除所有记录 */
export async function clearAllEmbeddings(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE_NAME);
  clearCachedModel();
}

/** 获取记录总数 */
export async function countEmbeddings(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_NAME);
}

/** 获取指定模型的记录数 */
export async function countEmbeddingsByModel(model: string): Promise<number> {
  const db = await getDb();
  return db.countFromIndex(STORE_NAME, 'model', model);
}

// ====== 向量搜索 ======

/** 从 IndexedDB 加载所有向量进行余弦相似度搜索 */
export async function searchVectors(
  queryVector: number[],
  limit: number = 10,
): Promise<{ id: string; score: number }[]> {
  if (!queryVector || queryVector.length === 0) return [];

  const db = await getDb();
  const cursor = await db.transaction(STORE_NAME).store.openCursor();
  const results: { id: string; score: number }[] = [];

  while (cursor) {
    const record = cursor.value as EmbeddingRecord;
    if (record.vector && record.vector.length === queryVector.length) {
      const score = cosineSimilarity(queryVector, record.vector);
      results.push({ id: record.id, score });
    }
    await cursor.continue();
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

// ====== 辅助 ======

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
