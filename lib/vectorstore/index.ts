/**
 * Vector Store Factory with Code Splitting
 * Implements lazy loading for vector store providers to reduce initial bundle size
 */

import 'server-only';

// Core types that are needed immediately
export type { VectorStoreType } from './unified';

// Lazy loading factory for vector stores
let openaiStore: unknown = null;
let neonStore: unknown = null;
let supabaseStore: unknown = null;
let memoryStore: unknown = null;
let unifiedStore: unknown = null;

/**
 * Get OpenAI vector store with lazy loading
 */
export async function getOpenAIVectorStore() {
  if (!openaiStore) {
    const { getOpenAIVectorStoreService } = await import('./openai');
    openaiStore = await getOpenAIVectorStoreService();
  }
  return openaiStore;
}

/**
 * Get Neon vector store with lazy loading
 */
export async function getNeonVectorStore() {
  if (!neonStore) {
    const { getNeonVectorStoreService } = await import('./neon');
    neonStore = await getNeonVectorStoreService();
  }
  return neonStore;
}

/**
 * Get Supabase vector store with lazy loading
 */
export async function getSupabaseVectorStore() {
  if (!supabaseStore) {
    const { getSupabaseVectorStoreService } = await import('./supabase');
    supabaseStore = await getSupabaseVectorStoreService();
  }
  return supabaseStore;
}

/**
 * Get Memory vector store with lazy loading
 */
export async function getMemoryVectorStore() {
  if (!memoryStore) {
    const { MemoryVectorStore } = await import('./memory-class');
    memoryStore = new MemoryVectorStore();
  }
  return memoryStore;
}

/**
 * Get Unified vector store with lazy loading
 */
export async function getUnifiedVectorStore() {
  if (!unifiedStore) {
    const { getUnifiedVectorStoreService } = await import('./unified');
    unifiedStore = await getUnifiedVectorStoreService();
  }
  return unifiedStore;
}

/**
 * Reset cached instances (useful for testing)
 */
export function resetCache() {
  openaiStore = null;
  neonStore = null;
  supabaseStore = null;
  memoryStore = null;
  unifiedStore = null;
}
