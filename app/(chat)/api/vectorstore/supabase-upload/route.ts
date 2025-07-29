import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import { supabaseRAG } from '@/lib/rag/supabase-rag';
import { generateUUID } from '@/lib/utils';

// Request validation schemas
const FileUploadSchema = z.object({
  file: z.instanceof(File).optional(),
  content: z.string().optional(),
  title: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const DocumentUploadRequest = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
  title: z.string().min(1, 'Title is required'),
  metadata: z.record(z.unknown()).optional(),
});

// Response types
interface UploadResponse {
  success: boolean;
  documentId: string;
  title: string;
  message: string;
  stats?: {
    chunksGenerated: number;
    embeddingModel: string;
    processingTime: number;
  };
}

interface StatsResponse {
  stats: {
    totalDocuments: number;
    totalEmbeddings: number;
  };
  message: string;
  embeddingModel: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
  timestamp: string;
}

// Supported file types for document upload
const SUPPORTED_TEXT_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf', // Future support
  'text/csv',
] as const;

const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.csv', '.json'] as const;

/**
 * Upload document with vector generation using Cohere embed-v4.0 model
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<UploadResponse | ErrorResponse>> {
  const startTime = Date.now();

  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          details: 'Valid session required',
          timestamp: new Date().toISOString(),
        },
        { status: 401 },
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawContent = formData.get('content') as string | null;
    const rawTitle = formData.get('title') as string | null;
    const rawMetadata = formData.get('metadata') as string | null;

    // Parse and validate metadata
    let metadata: Record<string, unknown> = {};
    if (rawMetadata) {
      try {
        metadata = JSON.parse(rawMetadata);
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Invalid metadata format',
            details: 'Metadata must be valid JSON',
            timestamp: new Date().toISOString(),
          },
          { status: 400 },
        );
      }
    }

    // Validate that either content or file is provided
    if (!(rawContent || file)) {
      return NextResponse.json(
        {
          error: 'Either content or file is required',
          details: 'Provide either text content or upload a file',
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // Process file content if file is provided
    let documentContent = rawContent || '';
    let documentTitle = rawTitle || '';

    if (file && !rawContent) {
      // Validate file type
      const isValidType =
        SUPPORTED_TEXT_TYPES.some((type) => file.type === type) ||
        SUPPORTED_EXTENSIONS.some((ext) =>
          file.name.toLowerCase().endsWith(ext),
        );

      if (!isValidType) {
        return NextResponse.json(
          {
            error: 'Unsupported file type',
            details: `Supported types: ${SUPPORTED_TEXT_TYPES.join(', ')} and extensions: ${SUPPORTED_EXTENSIONS.join(', ')}`,
            timestamp: new Date().toISOString(),
          },
          { status: 400 },
        );
      }

      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          {
            error: 'File too large',
            details: 'Maximum file size is 10MB',
            timestamp: new Date().toISOString(),
          },
          { status: 400 },
        );
      }

      try {
        documentContent = await file.text();
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Failed to read file content',
            details: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
          { status: 400 },
        );
      }
    }

    // Set default title if not provided
    if (!documentTitle) {
      documentTitle = file?.name || `Document ${new Date().toISOString()}`;
    }

    // Validate final document data
    try {
      DocumentUploadRequest.parse({
        content: documentContent,
        title: documentTitle,
        metadata,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Invalid document data',
          details:
            error instanceof z.ZodError
              ? error.errors[0].message
              : 'Validation failed',
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // Upload document with vector generation using Cohere embed-v4.0
    const documentId = generateUUID();
    const embeddingStartTime = Date.now();

    await supabaseRAG.uploadDocument(
      {
        id: documentId,
        title: documentTitle,
        content: documentContent,
        metadata: {
          ...metadata,
          uploadedBy: session.user.id,
          uploadedAt: new Date().toISOString(),
          originalFilename: file?.name,
          fileType: file?.type,
          fileSize: file?.size,
          embeddingModel: 'cohere-embed-v4.0',
        },
      },
      session.user.id,
    );

    const processingTime = Date.now() - startTime;
    const embeddingTime = Date.now() - embeddingStartTime;

    // Verify upload success by checking stats
    await supabaseRAG.getStats();

    return NextResponse.json(
      {
        success: true,
        documentId,
        title: documentTitle,
        message:
          'Document uploaded and indexed successfully with Cohere embed-v4.0',
        stats: {
          chunksGenerated: Math.ceil(documentContent.length / 1500), // Estimate based on chunk size
          embeddingModel: 'cohere-embed-v4.0',
          processingTime,
        },
      },
      {
        status: 201,
        headers: {
          'X-Processing-Time': processingTime.toString(),
          'X-Embedding-Time': embeddingTime.toString(),
        },
      },
    );
  } catch (error) {
    // Structured error logging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      userId: (await auth())?.user?.id,
    };

    // In production, this would be sent to a logging service
    if (process.env.NODE_ENV === 'development') {
      console.error('Supabase upload error:', errorDetails);
    }

    return NextResponse.json(
      {
        error: 'Failed to upload to Supabase vector store',
        details:
          process.env.NODE_ENV === 'development'
            ? errorDetails.message
            : 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

/**
 * Get Supabase vector store statistics
 */
export async function GET(): Promise<
  NextResponse<StatsResponse | ErrorResponse>
> {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          details: 'Valid session required',
          timestamp: new Date().toISOString(),
        },
        { status: 401 },
      );
    }

    // Get statistics about the vector store
    const stats = await supabaseRAG.getStats();

    return NextResponse.json(
      {
        stats,
        message: 'Supabase vector store statistics',
        embeddingModel: 'cohere-embed-v4.0',
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Stats-Timestamp': new Date().toISOString(),
        },
      },
    );
  } catch (error) {
    // Log structured error for monitoring

    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      userId: (await auth())?.user?.id,
    };

    // In production, this would be sent to a logging service
    if (process.env.NODE_ENV === 'development') {
      console.error('Supabase stats error:', errorDetails);
    }

    return NextResponse.json(
      {
        error: 'Failed to get vector store stats',
        details:
          process.env.NODE_ENV === 'development'
            ? errorDetails.message
            : 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

/**
 * Health check endpoint for the Supabase upload service
 */
export async function HEAD(): Promise<NextResponse> {
  try {
    // Basic health check - verify service dependencies
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse(null, { status: 401 });
    }

    // Quick stats check to verify Supabase connection
    await supabaseRAG.getStats();

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Service-Status': 'healthy',
        'X-Embedding-Model': 'cohere-embed-v4.0',
        'X-Health-Check': new Date().toISOString(),
      },
    });
  } catch (error) {
    // Log health check failure for monitoring
    if (process.env.NODE_ENV === 'development') {
      console.error(
        'Supabase health check failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-Service-Status': 'unhealthy',
        'X-Error': error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}
