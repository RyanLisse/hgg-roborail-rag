import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import { getUnifiedVectorStoreService } from '@/lib/vectorstore/unified';

// User feedback schema
const UserFeedbackSchema = z.object({
  queryId: z.string(),
  documentId: z.string(),
  rating: z.number().min(1).max(5),
  feedback: z.enum(['helpful', 'not_helpful', 'partially_helpful']),
  comments: z.string().optional(),
  interactionData: z
    .object({
      clicked: z.boolean().default(false),
      timeSpent: z.number().min(0).default(0), // seconds
      scrollDepth: z.number().min(0).max(1).optional(), // 0-1 percentage
      copied: z.boolean().default(false),
      shared: z.boolean().default(false),
    })
    .optional(),
});

// Preference update schema
const UserPreferencesSchema = z.object({
  preferredQueryTypes: z
    .array(
      z.enum([
        'technical',
        'conceptual',
        'procedural',
        'troubleshooting',
        'configuration',
        'api',
        'integration',
        'best_practices',
        'examples',
        'reference',
      ]),
    )
    .optional(),
  relevanceWeightAdjustments: z
    .object({
      similarity: z.number().min(-0.2).max(0.2).optional(),
      recency: z.number().min(-0.2).max(0.2).optional(),
      authority: z.number().min(-0.2).max(0.2).optional(),
      contextRelevance: z.number().min(-0.2).max(0.2).optional(),
      keywordMatch: z.number().min(-0.2).max(0.2).optional(),
      semanticMatch: z.number().min(-0.2).max(0.2).optional(),
      userFeedback: z.number().min(-0.2).max(0.2).optional(),
    })
    .optional(),
  contentPreferences: z
    .object({
      preferOfficialDocs: z.boolean().optional(),
      preferRecentContent: z.boolean().optional(),
      preferDetailedContent: z.boolean().optional(),
      preferExamples: z.boolean().optional(),
    })
    .optional(),
});

// Helper function to handle feedback recording
async function handleFeedback(
  body: any,
  vectorStoreService: any,
  userId: string,
) {
  let validatedFeedback: z.infer<typeof UserFeedbackSchema>;
  try {
    validatedFeedback = UserFeedbackSchema.parse(body.data);
  } catch (validationError: any) {
    return NextResponse.json(
      {
        error: 'Invalid feedback format',
        details:
          validationError instanceof z.ZodError
            ? validationError.errors
            : 'Unknown validation error',
      },
      { status: 400 },
    );
  }

  const feedback = {
    ...validatedFeedback,
    userId,
    timestamp: new Date(),
  };

  await vectorStoreService.recordUserFeedback(feedback);

  return NextResponse.json({
    success: true,
    message: 'Feedback recorded successfully',
    feedbackId: crypto.randomUUID(),
  });
}

// Helper function to handle preferences update
async function handlePreferences(
  body: any,
  vectorStoreService: any,
  userId: string,
) {
  let validatedPreferences: z.infer<typeof UserPreferencesSchema>;
  try {
    validatedPreferences = UserPreferencesSchema.parse(body.data);
  } catch (validationError: any) {
    return NextResponse.json(
      {
        error: 'Invalid preferences format',
        details:
          validationError instanceof z.ZodError
            ? validationError.errors
            : 'Unknown validation error',
      },
      { status: 400 },
    );
  }

  // Apply preference adjustments
  if (validatedPreferences.relevanceWeightAdjustments) {
    await vectorStoreService.updateUserPreferences(
      userId,
      validatedPreferences.relevanceWeightAdjustments,
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Preferences updated successfully',
    updatedPreferences: validatedPreferences,
  });
}

// Helper function to handle interaction recording
async function handleInteraction(
  body: any,
  vectorStoreService: any,
  userId: string,
) {
  const { queryId, interactions } = body.data;

  if (!(queryId && Array.isArray(interactions))) {
    return NextResponse.json(
      {
        error:
          'Invalid interaction data: queryId and interactions array required',
      },
      { status: 400 },
    );
  }

  // Record interactions for learning-to-rank algorithm
  await Promise.all(
    interactions.map(async (interaction: any) => {
      try {
        await vectorStoreService.recordInteraction({
          queryId,
          documentId: interaction.documentId,
          userId,
          timestamp: new Date(),
          interactionType: interaction.type,
          metadata: interaction.metadata || {},
        });
      } catch (_error) {
        // Failed to record interaction - continue silently
      }
    }),
  );

  return NextResponse.json({
    success: true,
    message: 'Interactions recorded successfully',
    interactionCount: interactions.length,
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;
    const vectorStoreService = await getUnifiedVectorStoreService();

    switch (action) {
      case 'feedback':
        return await handleFeedback(body, vectorStoreService, session.user.id);
      case 'preferences':
        return await handlePreferences(
          body,
          vectorStoreService,
          session.user.id,
        );
      case 'interaction':
        return await handleInteraction(
          body,
          vectorStoreService,
          session.user.id,
        );
      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Supported actions: feedback, preferences, interaction',
          },
          { status: 400 },
        );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to process feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';

    const vectorStoreService = await getUnifiedVectorStoreService();

    if (type === 'preferences') {
      // Get user preferences
      const preferences = await vectorStoreService.getUserPreferences(
        session.user.id,
      );

      return NextResponse.json({
        userId: session.user.id,
        preferences,
        lastUpdated: new Date().toISOString(),
      });
    } else if (type === 'metrics') {
      // Get user-specific feedback metrics
      const metrics = await vectorStoreService.getRelevanceMetrics();

      return NextResponse.json({
        userId: session.user.id,
        metrics,
        feedbackGuidelines: {
          rating: {
            5: 'Extremely helpful - exactly what I needed',
            4: 'Very helpful - mostly what I needed',
            3: 'Somewhat helpful - partially useful',
            2: 'Not very helpful - limited usefulness',
            1: 'Not helpful at all - completely irrelevant',
          },
          feedback: {
            helpful: 'Use when the document directly answers your question',
            partially_helpful:
              'Use when the document contains some relevant information',
            not_helpful: 'Use when the document is irrelevant or incorrect',
          },
        },
      });
    } else {
      // Default summary
      const [preferences, metrics] = await Promise.all([
        vectorStoreService.getUserPreferences(session.user.id),
        vectorStoreService.getRelevanceMetrics(),
      ]);

      return NextResponse.json({
        userId: session.user.id,
        preferences,
        metrics,
        feedbackEndpoint: {
          url: '/api/vectorstore/feedback',
          methods: ['GET', 'POST'],
          actions: {
            feedback: 'Record feedback for a specific document',
            preferences: 'Update user search preferences',
            interaction: 'Record user interaction data',
          },
        },
        documentation: {
          feedbackFlow: [
            '1. User performs enhanced search',
            '2. User interacts with results (clicks, reads, etc.)',
            '3. User provides explicit feedback (rating + comments)',
            '4. System learns from feedback to improve future results',
            '5. User preferences are updated automatically',
          ],
          improvementCycle: [
            'Collect user feedback and interaction data',
            'Analyze patterns in user preferences',
            'Adjust relevance scoring weights',
            'Train learning-to-rank models',
            'Improve search result quality',
          ],
        },
      });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to get feedback information' },
      { status: 500 },
    );
  }
}
