import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUnifiedVectorStoreService } from '@/lib/vectorstore/unified';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const content = formData.get('content') as string;
    const targetSources = JSON.parse(
      (formData.get('targetSources') as string) || '["memory"]',
    );
    const metadata = JSON.parse((formData.get('metadata') as string) || '{}');

    if (!content && !file) {
      return NextResponse.json(
        { error: 'Either content or file is required' },
        { status: 400 },
      );
    }

    const vectorStoreService = await getUnifiedVectorStoreService();

    // If file is provided but no content, extract content from file
    let documentContent = content;
    if (file && !content) {
      // For text files, read the content
      if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md')
      ) {
        documentContent = await file.text();
      } else {
        // For other file types, use filename as content placeholder
        documentContent = `File: ${file.name}`;
      }
    }

    const documents = await vectorStoreService.addDocument({
      content: documentContent,
      metadata: {
        ...metadata,
        uploadedBy: session.user.id,
        uploadedAt: new Date().toISOString(),
        originalFilename: file?.name,
        fileType: file?.type,
      },
      file: file || undefined,
      targetSources,
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Failed to upload to vector store:', error);
    return NextResponse.json(
      { error: 'Failed to upload to vector store' },
      { status: 500 },
    );
  }
}
