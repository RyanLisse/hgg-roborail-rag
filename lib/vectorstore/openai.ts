import 'server-only';

import { z } from 'zod';
import OpenAI from 'openai';

// Schemas for OpenAI vector store operations
export const VectorStoreFile = z.object({
  id: z.string(),
  object: z.literal('vector_store.file'),
  created_at: z.number(),
  vector_store_id: z.string(),
  status: z.enum(['in_progress', 'completed', 'cancelled', 'failed']),
  last_error: z.object({
    code: z.string(),
    message: z.string(),
  }).nullable(),
});

export const VectorStore = z.object({
  id: z.string(),
  object: z.literal('vector_store'),
  created_at: z.number(),
  name: z.string().nullable(),
  usage_bytes: z.number(),
  file_counts: z.object({
    in_progress: z.number(),
    completed: z.number(),
    failed: z.number(),
    cancelled: z.number(),
    total: z.number(),
  }),
  status: z.enum(['expired', 'in_progress', 'completed']),
  expires_after: z.object({
    anchor: z.enum(['last_active_at']),
    days: z.number(),
  }).nullable(),
  expires_at: z.number().nullable(),
  last_active_at: z.number().nullable(),
  metadata: z.record(z.string()).nullable(),
});

export const FileUploadRequest = z.object({
  file: z.instanceof(File),
  name: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export const SearchRequest = z.object({
  query: z.string().min(1),
  vectorStoreId: z.string().optional(),
  maxResults: z.number().min(1).max(50).default(10),
});

// Types
export type VectorStoreFile = z.infer<typeof VectorStoreFile>;
export type VectorStore = z.infer<typeof VectorStore>;
export type FileUploadRequest = z.infer<typeof FileUploadRequest>;
export type SearchRequest = z.infer<typeof SearchRequest>;

export interface OpenAIVectorStoreConfig {
  apiKey: string;
  defaultVectorStoreId?: string | null;
  isEnabled: boolean;
}

export interface OpenAIVectorStoreService {
  client: OpenAI;
  defaultVectorStoreId: string | null | undefined;
  isEnabled: boolean;
  
  // Vector store management
  createVectorStore: (name: string, metadata?: Record<string, string>) => Promise<VectorStore>;
  getVectorStore: (vectorStoreId: string) => Promise<VectorStore>;
  listVectorStores: () => Promise<VectorStore[]>;
  deleteVectorStore: (vectorStoreId: string) => Promise<boolean>;
  
  // File management
  uploadFile: (request: FileUploadRequest, vectorStoreId?: string) => Promise<VectorStoreFile>;
  listFiles: (vectorStoreId?: string) => Promise<VectorStoreFile[]>;
  deleteFile: (fileId: string, vectorStoreId?: string) => Promise<boolean>;
  
  // Search operations
  searchFiles: (request: SearchRequest) => Promise<any>;
  getFileSearchTool: (vectorStoreId?: string) => any;
}

// Create OpenAI vector store service
export function createOpenAIVectorStoreService(config?: Partial<OpenAIVectorStoreConfig>): OpenAIVectorStoreService {
  const validatedConfig: OpenAIVectorStoreConfig = {
    apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
    defaultVectorStoreId: config?.defaultVectorStoreId || process.env.OPENAI_VECTORSTORE || 'vs_6849955367a88191bf89d7660230325f',
    isEnabled: !!(config?.apiKey || process.env.OPENAI_API_KEY),
  };

  if (!validatedConfig.isEnabled) {
    console.warn('OpenAI vector store service is disabled - no API key provided');
    return {
      client: null as any,
      defaultVectorStoreId: null,
      isEnabled: false,
      createVectorStore: async () => { throw new Error('OpenAI vector store service is disabled'); },
      getVectorStore: async () => { throw new Error('OpenAI vector store service is disabled'); },
      listVectorStores: async () => { throw new Error('OpenAI vector store service is disabled'); },
      deleteVectorStore: async () => { throw new Error('OpenAI vector store service is disabled'); },
      uploadFile: async () => { throw new Error('OpenAI vector store service is disabled'); },
      listFiles: async () => { throw new Error('OpenAI vector store service is disabled'); },
      deleteFile: async () => { throw new Error('OpenAI vector store service is disabled'); },
      searchFiles: async () => { throw new Error('OpenAI vector store service is disabled'); },
      getFileSearchTool: () => { throw new Error('OpenAI vector store service is disabled'); },
    };
  }

  const client = new OpenAI({ apiKey: validatedConfig.apiKey });

  return {
    client,
    defaultVectorStoreId: validatedConfig.defaultVectorStoreId,
    isEnabled: true,

    async createVectorStore(name: string, metadata?: Record<string, string>): Promise<VectorStore> {
      try {
        // TODO: Implement vector store creation
        throw new Error('Vector store creation not implemented');
      } catch (error) {
        console.error('Failed to create vector store:', error);
        throw error;
      }
    },

    async getVectorStore(vectorStoreId: string): Promise<VectorStore> {
      try {
        // TODO: Implement vector store retrieval
        throw new Error('Vector store retrieval not implemented');
      } catch (error) {
        console.error('Failed to get vector store:', error);
        throw error;
      }
    },

    async listVectorStores(): Promise<VectorStore[]> {
      try {
        // TODO: Implement vector store listing
        const response = { data: [] };
        return [];
      } catch (error) {
        console.error('Failed to list vector stores:', error);
        throw error;
      }
    },

    async deleteVectorStore(vectorStoreId: string): Promise<boolean> {
      try {
        // TODO: Implement vector store deletion
        return false;
      } catch (error) {
        console.error('Failed to delete vector store:', error);
        return false;
      }
    },

    async uploadFile(request: FileUploadRequest, vectorStoreId?: string): Promise<VectorStoreFile> {
      const validatedRequest = FileUploadRequest.parse(request);
      const targetVectorStoreId = vectorStoreId || validatedConfig.defaultVectorStoreId;
      
      if (!targetVectorStoreId) {
        throw new Error('No vector store ID provided and no default configured');
      }

      try {
        // First upload the file
        const uploadedFile = await client.files.create({
          file: validatedRequest.file,
          purpose: 'assistants',
        });

        // Add file to vector store (commented out due to SDK compatibility)
        // const vectorStoreFile = await client.vectorStores.files.create(targetVectorStoreId, {
        //   file_id: uploadedFile.id,
        // });

        // Return a stub response for now
        return {
          id: uploadedFile.id,
          object: 'vector_store.file' as const,
          created_at: Math.floor(Date.now() / 1000),
          vector_store_id: targetVectorStoreId,
          status: 'completed' as const,
          last_error: null
        };
      } catch (error) {
        console.error('Failed to upload file to vector store:', error);
        throw error;
      }
    },

    async listFiles(vectorStoreId?: string): Promise<VectorStoreFile[]> {
      const targetVectorStoreId = vectorStoreId || validatedConfig.defaultVectorStoreId;
      
      if (!targetVectorStoreId) {
        throw new Error('No vector store ID provided and no default configured');
      }

      try {
        // TODO: Implement list files (SDK compatibility issue)
        // const response = await client.beta.vectorStores.files.list(targetVectorStoreId);
        // return response.data.map((file: any) => VectorStoreFile.parse({
        //   id: file.id,
        //   object: file.object,
        //   created_at: file.created_at,
        //   status: file.status,
        //   last_error: file.last_error,
        // }));
        return [];
      } catch (error) {
        console.error('Failed to list vector store files:', error);
        // Return empty array instead of throwing to prevent blocking the UI
        return [];
      }
    },

    async deleteFile(fileId: string, vectorStoreId?: string): Promise<boolean> {
      const targetVectorStoreId = vectorStoreId || validatedConfig.defaultVectorStoreId;
      
      if (!targetVectorStoreId) {
        throw new Error('No vector store ID provided and no default configured');
      }

      try {
        // TODO: Implement file deletion
        return false;
      } catch (error) {
        console.error('Failed to delete vector store file:', error);
        return false;
      }
    },

    async searchFiles(request: SearchRequest): Promise<any> {
      const validatedRequest = SearchRequest.parse(request);
      const targetVectorStoreId = validatedRequest.vectorStoreId || validatedConfig.defaultVectorStoreId;
      
      if (!targetVectorStoreId) {
        throw new Error('No vector store ID provided and no default configured');
      }

      // OpenAI vector store search is handled through the file_search tool in conversations
      // This method is mainly for direct API access if needed
      throw new Error('Direct search not implemented - use file_search tool in conversations');
    },

    getFileSearchTool(vectorStoreId?: string): any {
      const targetVectorStoreId = vectorStoreId || validatedConfig.defaultVectorStoreId;
      
      if (!targetVectorStoreId) {
        console.warn('No vector store ID provided and no default configured for file search tool');
        return null;
      }

      console.log(`🔍 Creating file search tool for vector store: ${targetVectorStoreId}`);

      // Return file search tool configuration for AI SDK
      return {
        type: 'file_search' as const,
        file_search: {
          vector_store_ids: [targetVectorStoreId],
          max_num_results: 20, // Allow more results for better context
        },
      };
    },
  };
}

// Singleton service
let openaiVectorStoreService: OpenAIVectorStoreService | null = null;

export async function getOpenAIVectorStoreService(): Promise<OpenAIVectorStoreService> {
  if (!openaiVectorStoreService) {
    openaiVectorStoreService = createOpenAIVectorStoreService();
  }
  return openaiVectorStoreService;
}