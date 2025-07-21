/**
 * Vector Store Factory with Code Splitting
 * Implements lazy loading for vector store providers to reduce initial bundle size
 */

import "server-only";

// Core types that are needed immediately
export type { VectorStoreType } from "./unified";

// Lazy loading factory for vector stores
let openaiStore: any = null;
let neonStore: any = null;
let memoryStore: any = null;
let unifiedStore: any = null;

/**
 * Get OpenAI vector store with lazy loading
 */
export async function getOpenAIVectorStore() {
  if (!openaiStore && process.env.ENABLE_CODE_SPLITTING !== "false") {
    const { getOpenAIVectorStoreService } = await import("./openai");
    openaiStore = await getOpenAIVectorStoreService();
  } else if (!openaiStore) {
    // Fallback to direct import if code splitting disabled
    const { getOpenAIVectorStoreService } = require("./openai");
    openaiStore = await getOpenAIVectorStoreService();
  }
  return openaiStore;
}

/**
 * Get Neon vector store with lazy loading
 */
export async function getNeonVectorStore() {
  if (!neonStore && process.env.ENABLE_CODE_SPLITTING !== "false") {
    const { getNeonVectorStoreService } = await import("./neon");
    neonStore = await getNeonVectorStoreService();
  } else if (!neonStore) {
    // Fallback to direct import if code splitting disabled
    const { getNeonVectorStoreService } = require("./neon");
    neonStore = await getNeonVectorStoreService();
  }
  return neonStore;
}

/**
 * Get Memory vector store with lazy loading
 */
export async function getMemoryVectorStore() {
  if (!memoryStore && process.env.ENABLE_CODE_SPLITTING !== "false") {
    const { MemoryVectorStore } = await import("./memory-class");
    memoryStore = new MemoryVectorStore();
  } else if (!memoryStore) {
    // Fallback to direct import if code splitting disabled
    const { MemoryVectorStore } = require("./memory-class");
    memoryStore = new MemoryVectorStore();
  }
  return memoryStore;
}

/**
 * Get Unified vector store with lazy loading
 */
export async function getUnifiedVectorStore() {
  if (!unifiedStore && process.env.ENABLE_CODE_SPLITTING !== "false") {
    const { getUnifiedVectorStoreService } = await import("./unified");
    unifiedStore = await getUnifiedVectorStoreService();
  } else if (!unifiedStore) {
    // Fallback to direct import if code splitting disabled
    const { getUnifiedVectorStoreService } = require("./unified");
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
  memoryStore = null;
  unifiedStore = null;
}
