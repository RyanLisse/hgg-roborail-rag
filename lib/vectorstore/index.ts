/**
 * Vector Store Factory with Code Splitting
 * Implements lazy loading for vector store providers to reduce initial bundle size
 */

import 'server-only';

// Core types that are needed immediately
export type { VectorStoreType } from './unified';

// Lazy loading factory for vector stores
export class VectorStoreFactory {
  private static openaiStore: any = null;
  private static neonStore: any = null;
  private static memoryStore: any = null;
  private static unifiedStore: any = null;

  /**
   * Get OpenAI vector store with lazy loading
   */
  static async getOpenAIVectorStore() {
    if (!VectorStoreFactory.openaiStore && process.env.ENABLE_CODE_SPLITTING !== 'false') {
      const { getOpenAIVectorStoreService } = await import('./openai');
      VectorStoreFactory.openaiStore = await getOpenAIVectorStoreService();
    } else if (!VectorStoreFactory.openaiStore) {
      // Fallback to direct import if code splitting disabled
      const { getOpenAIVectorStoreService } = require('./openai');
      VectorStoreFactory.openaiStore = await getOpenAIVectorStoreService();
    }
    return VectorStoreFactory.openaiStore;
  }

  /**
   * Get Neon vector store with lazy loading
   */
  static async getNeonVectorStore() {
    if (!VectorStoreFactory.neonStore && process.env.ENABLE_CODE_SPLITTING !== 'false') {
      const { getNeonVectorStoreService } = await import('./neon');
      VectorStoreFactory.neonStore = await getNeonVectorStoreService();
    } else if (!VectorStoreFactory.neonStore) {
      // Fallback to direct import if code splitting disabled
      const { getNeonVectorStoreService } = require('./neon');
      VectorStoreFactory.neonStore = await getNeonVectorStoreService();
    }
    return VectorStoreFactory.neonStore;
  }

  /**
   * Get Memory vector store with lazy loading
   */
  static async getMemoryVectorStore() {
    if (!VectorStoreFactory.memoryStore && process.env.ENABLE_CODE_SPLITTING !== 'false') {
      const { MemoryVectorStore } = await import('./memory-class');
      VectorStoreFactory.memoryStore = new MemoryVectorStore();
    } else if (!VectorStoreFactory.memoryStore) {
      // Fallback to direct import if code splitting disabled
      const { MemoryVectorStore } = require('./memory-class');
      VectorStoreFactory.memoryStore = new MemoryVectorStore();
    }
    return VectorStoreFactory.memoryStore;
  }

  /**
   * Get Unified vector store with lazy loading
   */
  static async getUnifiedVectorStore() {
    if (!VectorStoreFactory.unifiedStore && process.env.ENABLE_CODE_SPLITTING !== 'false') {
      const { getUnifiedVectorStoreService } = await import('./unified');
      VectorStoreFactory.unifiedStore = await getUnifiedVectorStoreService();
    } else if (!VectorStoreFactory.unifiedStore) {
      // Fallback to direct import if code splitting disabled
      const { getUnifiedVectorStoreService } = require('./unified');
      VectorStoreFactory.unifiedStore = await getUnifiedVectorStoreService();
    }
    return VectorStoreFactory.unifiedStore;
  }

  /**
   * Reset cached instances (useful for testing)
   */
  static resetCache() {
    VectorStoreFactory.openaiStore = null;
    VectorStoreFactory.neonStore = null;
    VectorStoreFactory.memoryStore = null;
    VectorStoreFactory.unifiedStore = null;
  }
}

// Legacy exports for backward compatibility
export { VectorStoreFactory as default };
export const getOpenAIVectorStore = VectorStoreFactory.getOpenAIVectorStore.bind(VectorStoreFactory);
export const getNeonVectorStore = VectorStoreFactory.getNeonVectorStore.bind(VectorStoreFactory);
export const getMemoryVectorStore = VectorStoreFactory.getMemoryVectorStore.bind(VectorStoreFactory);
export const getUnifiedVectorStore = VectorStoreFactory.getUnifiedVectorStore.bind(VectorStoreFactory);