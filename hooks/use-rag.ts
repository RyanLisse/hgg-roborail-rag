'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

type VectorStoreType = 'openai' | 'neon' | 'supabase' | 'memory';

import { nanoid } from 'nanoid';

// Schemas
const DocumentMetadata = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  uploadedAt: z.date(),
  title: z.string().optional(),
  source: z.string().optional(),
});

const DocumentUpload = z.object({
  file: z.instanceof(File),
  metadata: DocumentMetadata,
});

const StoredDocument = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  uploadedAt: z.date(),
  status: z.enum(['uploading', 'processing', 'processed', 'error']),
  content: z.string().optional(),
  error: z.string().optional(),
  source: z.enum(['openai', 'neon', 'supabase', 'memory', 'local']).optional(),
  vectorStoreId: z.string().optional(),
});

const RemoteFile = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  createdAt: z.date(),
  source: z.enum(['openai', 'neon', 'supabase', 'memory']),
  vectorStoreId: z.string().optional(),
});

const FilesResponse = z.object({
  files: z.array(RemoteFile),
  availableSources: z
    .array(z.enum(['openai', 'neon', 'supabase', 'memory']))
    .optional(),
  sourceStats: z
    .record(
      z.object({
        enabled: z.boolean(),
        count: z.number().optional(),
      }),
    )
    .optional(),
});

// Types
type DocumentUpload = z.infer<typeof DocumentUpload>;
type StoredDocument = z.infer<typeof StoredDocument>;
type RemoteFile = z.infer<typeof RemoteFile>;
type FilesResponse = z.infer<typeof FilesResponse>;

// Supported file types
const SUPPORTED_FILE_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

// RAG query interfaces
interface RAGQueryOptions {
  vectorStoreSources: VectorStoreType[];
  useFileSearch: boolean;
  useWebSearch: boolean;
}

interface RAGQueryRequest {
  question: string;
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  modelId: string;
  options: RAGQueryOptions;
}

interface RAGResponse {
  answer: string;
  sources: Array<{
    documentId: string;
    content: string;
    score: number;
    metadata?: Record<string, any>;
  }>;
  runId?: string;
  responseId?: string;
}

// File processing utilities
async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;

      // For now, just handle text files directly
      // In a real app, you'd use libraries for PDF, DOCX, etc.
      if (file.type === 'text/plain' || file.type === 'text/markdown') {
        resolve(result);
      } else {
        resolve(result); // Fallback for other types
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function validateFileType(file: File): void {
  if (!SUPPORTED_FILE_TYPES.includes(file.type as any)) {
    throw new Error(
      `Unsupported file type: ${file.type}. Supported types: ${SUPPORTED_FILE_TYPES.join(', ')}`,
    );
  }
}

function validateFileSize(file: File, maxSizeMB = 10): void {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
  }
}

// Local storage utilities
const STORAGE_KEY = 'rag-documents';

function getStoredDocuments(): StoredDocument[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return parsed.map((doc: any) => ({
      ...doc,
      uploadedAt: new Date(doc.uploadedAt),
    }));
  } catch {
    return [];
  }
}

function saveDocuments(documents: StoredDocument[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  } catch (_error) {}
}

// API service functions
async function fetchRemoteFiles(
  source?: VectorStoreType,
): Promise<FilesResponse> {
  const params = new URLSearchParams();
  if (source) {
    params.set('source', source);
  }

  const response = await fetch(`/api/vectorstore/files?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch files: ${response.statusText}`);
  }

  const data = await response.json();

  // Transform the response to match our schema
  return FilesResponse.parse({
    files: data.files.map((file: any) => ({
      ...file,
      createdAt: new Date(file.createdAt),
    })),
    availableSources: data.availableSources,
    sourceStats: data.sourceStats,
  });
}

async function deleteRemoteDocument(
  documentId: string,
  source: VectorStoreType,
): Promise<boolean> {
  const response = await fetch('/api/vectorstore/delete', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documentId,
      source,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete document: ${response.statusText}`);
  }

  const data = await response.json();
  return data.success;
}

export function useRAG() {
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const queryClient = useQueryClient();

  // Get stored documents
  const { data: documents = [] } = useQuery<StoredDocument[]>({
    queryKey: ['rag-documents'],
    queryFn: getStoredDocuments,
    staleTime: Number.POSITIVE_INFINITY,
  });

  // Query for remote files
  const {
    data: remoteFiles,
    refetch: refetchRemoteFiles,
    isLoading: isLoadingRemoteFiles,
  } = useQuery<FilesResponse>({
    queryKey: ['remote-files'],
    queryFn: () => fetchRemoteFiles('openai'), // Default to OpenAI vector store
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: 1000,
    enabled: isHydrated, // Only fetch after hydration
  });

  // Hydration effect - runs once on mount
  useEffect(() => {
    const hydrateDocuments = async () => {
      try {
        setIsHydrating(true);

        // Get current local documents
        const localDocs = getStoredDocuments();

        // Fetch remote files to reconcile state
        const remoteResponse = await fetchRemoteFiles('openai').catch(
          (_error) => {
            return { files: [] as RemoteFile[] };
          },
        );

        const remoteFiles = remoteResponse.files || [];
        let needsUpdate = false;
        const updatedDocs = [...localDocs];

        // Update any documents with "processing" or "error" status
        for (let i = 0; i < updatedDocs.length; i++) {
          const doc = updatedDocs[i];

          // Check if we have a corresponding remote file
          const remoteFile = remoteFiles.find(
            (rf) =>
              rf.id === doc.id ||
              (rf.name && doc.name && rf.name.includes(doc.name)),
          );

          if (remoteFile) {
            // Update document status based on remote file
            if (doc.status === 'processing' || doc.status === 'error') {
              if (remoteFile.status === 'completed') {
                updatedDocs[i] = {
                  ...doc,
                  status: 'processed',
                  source: remoteFile.source,
                  vectorStoreId: remoteFile.vectorStoreId,
                  error: undefined,
                };
                needsUpdate = true;
              } else if (remoteFile.status === 'failed') {
                updatedDocs[i] = {
                  ...doc,
                  status: 'error',
                  error: 'Remote processing failed',
                };
                needsUpdate = true;
              }
            }
          } else if (doc.status === 'processing') {
            // If we have a processing document but no remote file, mark as error
            const processingTime = Date.now() - doc.uploadedAt.getTime();
            const maxProcessingTime = 5 * 60 * 1000; // 5 minutes

            if (processingTime > maxProcessingTime) {
              updatedDocs[i] = {
                ...doc,
                status: 'error',
                error: 'Processing timeout - please try uploading again',
              };
              needsUpdate = true;
            }
          }
        }

        // Save updated documents if needed
        if (needsUpdate) {
          queryClient.setQueryData(['rag-documents'], updatedDocs);
          saveDocuments(updatedDocs);
        }

        setIsHydrated(true);
      } catch (_error) {
        setIsHydrated(true); // Continue even if hydration fails
      } finally {
        setIsHydrating(false);
      }
    };

    hydrateDocuments();
  }, [queryClient]); // Only run once on mount

  // Document upload mutation
  const { mutate: addDocument, isPending: isUploadingDocument } = useMutation({
    mutationFn: async (uploadData: DocumentUpload): Promise<StoredDocument> => {
      const { file, metadata } = DocumentUpload.parse(uploadData);

      // Validate file
      validateFileType(file);
      validateFileSize(file);

      const documentId = nanoid();
      const newDocument: StoredDocument = {
        id: documentId,
        name: metadata.name,
        size: metadata.size,
        uploadedAt: metadata.uploadedAt,
        status: 'uploading',
        source: 'local', // Initially local until uploaded
      };

      // Update documents list immediately
      const currentDocs =
        queryClient.getQueryData<StoredDocument[]>(['rag-documents']) || [];
      const updatedDocs = [...currentDocs, newDocument];
      queryClient.setQueryData(['rag-documents'], updatedDocs);
      saveDocuments(updatedDocs);

      try {
        // Extract text content
        newDocument.status = 'processing';
        queryClient.setQueryData(
          ['rag-documents'],
          updatedDocs.map((doc) => (doc.id === documentId ? newDocument : doc)),
        );

        const content = await extractTextFromFile(file);
        newDocument.content = content;

        // Upload document to vector stores via API
        const formData = new FormData();
        formData.append('file', file);
        formData.append(
          'metadata',
          JSON.stringify({
            title: metadata.title || metadata.name,
            source: metadata.source || 'upload',
            name: metadata.name,
            size: metadata.size,
            type: metadata.type,
          }),
        );

        const response = await fetch('/api/vectorstore/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const uploadResult = await response.json();

        newDocument.status = 'processed';
        newDocument.source = 'openai'; // Mark as successfully uploaded to OpenAI

        // Store the first document ID from the upload result if available
        if (uploadResult.documents && uploadResult.documents.length > 0) {
          const openaiDoc = uploadResult.documents.find(
            (doc: any) => doc.source === 'openai',
          );
          if (openaiDoc) {
            newDocument.id = openaiDoc.id; // Use the actual OpenAI file ID
          }
        }

        const finalDocs = updatedDocs.map((doc) =>
          doc.id === documentId ? newDocument : doc,
        );

        queryClient.setQueryData(['rag-documents'], finalDocs);
        saveDocuments(finalDocs);

        // Refetch remote files to update the list
        refetchRemoteFiles();

        return newDocument;
      } catch (error) {
        newDocument.status = 'error';
        newDocument.error =
          error instanceof Error ? error.message : 'Unknown error';

        const errorDocs = updatedDocs.map((doc) =>
          doc.id === documentId ? newDocument : doc,
        );

        queryClient.setQueryData(['rag-documents'], errorDocs);
        saveDocuments(errorDocs);

        throw error;
      }
    },
  });

  // Document removal mutation with enhanced functionality
  const { mutate: removeDocument, isPending: isDeletingDocument } = useMutation(
    {
      mutationFn: async (documentId: string): Promise<void> => {
        const currentDocs =
          queryClient.getQueryData<StoredDocument[]>(['rag-documents']) || [];
        const documentToDelete = currentDocs.find(
          (doc) => doc.id === documentId,
        );

        if (!documentToDelete) {
          throw new Error('Document not found');
        }

        // Optimistic update - remove from local state immediately
        const filteredDocs = currentDocs.filter((doc) => doc.id !== documentId);
        queryClient.setQueryData(['rag-documents'], filteredDocs);
        saveDocuments(filteredDocs);

        // If the document has a remote source, attempt to delete it remotely
        if (documentToDelete.source && documentToDelete.source !== 'local') {
          try {
            const success = await deleteRemoteDocument(
              documentId,
              documentToDelete.source,
            );

            if (success) {
              // Refetch remote files to update the list
              refetchRemoteFiles();
            } else {
              // Note: We still keep the local deletion since the optimistic update already happened
            }
          } catch (_error) {
            // Note: We still keep the local deletion for a better UX
            // The user can retry if needed
          }
        }
      },
      onError: (_error, documentId) => {
        // Revert optimistic update on error
        const currentDocs =
          queryClient.getQueryData<StoredDocument[]>(['rag-documents']) || [];
        const originalDocs = getStoredDocuments();
        const originalDoc = originalDocs.find((doc) => doc.id === documentId);

        if (originalDoc) {
          const revertedDocs = [...currentDocs, originalDoc];
          queryClient.setQueryData(['rag-documents'], revertedDocs);
          saveDocuments(revertedDocs);
        }
      },
    },
  );

  // RAG query mutation
  const { mutate: executeQuery, isPending: isQuerying } = useMutation({
    mutationFn: async (queryRequest: RAGQueryRequest): Promise<RAGResponse> => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            ...queryRequest.chatHistory,
            { role: 'user', content: queryRequest.question },
          ],
          modelId: queryRequest.modelId,
          ragOptions: {
            vectorStoreSources: queryRequest.options.vectorStoreSources,
            useFileSearch: queryRequest.options.useFileSearch,
            useWebSearch: queryRequest.options.useWebSearch,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`);
      }

      const data = await response.json();

      const ragResponse: RAGResponse = {
        answer: data.answer || data.content || 'No response generated',
        sources: data.sources || [],
        runId: data.runId,
        responseId: data.responseId,
      };

      setResponse(ragResponse);
      setError(null);
      return ragResponse;
    },
    onError: (error: Error) => {
      setError(error);
      setResponse(null);
    },
  });

  // Wrap query function to return a promise
  const query = useCallback(
    async (queryData: RAGQueryRequest): Promise<RAGResponse> => {
      return new Promise((resolve, reject) => {
        executeQuery(queryData, {
          onSuccess: resolve,
          onError: reject,
        });
      });
    },
    [executeQuery],
  );

  // Helper function to refresh all data
  const refreshAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rag-documents'] }),
      refetchRemoteFiles(),
    ]);
  }, [queryClient, refetchRemoteFiles]);

  return {
    // State
    documents,
    remoteFiles: remoteFiles?.files || [],
    availableSources: remoteFiles?.availableSources || [],
    sourceStats: remoteFiles?.sourceStats || {},
    response,
    error,

    // Loading states
    isLoading: isQuerying || isUploadingDocument || isDeletingDocument,
    isHydrating,
    isHydrated,
    isQuerying,
    isUploadingDocument,
    isDeletingDocument,
    isLoadingRemoteFiles,

    // Actions
    query,
    addDocument,
    removeDocument,
    refreshAll,
    refetchRemoteFiles,
  };
}
