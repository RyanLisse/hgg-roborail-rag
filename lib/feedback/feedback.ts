import 'server-only';

import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { POSTGRES_URL } from '../env';

// Feedback schemas
export const MessageFeedback = z.object({
  runId: z.string().min(1),
  messageId: z.string().min(1),
  userId: z.string().min(1),
  vote: z.enum(['up', 'down']),
  comment: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const FeedbackUpdate = z.object({
  vote: z.enum(['up', 'down']).optional(),
  comment: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const FeedbackStats = z.object({
  total: z.number(),
  upvotes: z.number(),
  downvotes: z.number(),
  ratio: z.number(), // upvotes / total
  hasComments: z.number(),
});

// Types
export type MessageFeedback = z.infer<typeof MessageFeedback>;
export type FeedbackUpdate = z.infer<typeof FeedbackUpdate>;
export type FeedbackStats = z.infer<typeof FeedbackStats>;

export interface StoredFeedback extends MessageFeedback {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackService {
  db: any; // Database instance
  submitFeedback: (feedback: MessageFeedback) => Promise<StoredFeedback>;
  getFeedbackByRunId: (runId: string) => Promise<StoredFeedback[]>;
  getFeedbackByUserId: (userId: string) => Promise<StoredFeedback[]>;
  updateFeedback: (
    id: string,
    updates: FeedbackUpdate,
  ) => Promise<StoredFeedback>;
  deleteFeedback: (id: string) => Promise<boolean>;
  getStats: (runId: string) => Promise<FeedbackStats>;
  submitBatch: (feedbackList: MessageFeedback[]) => Promise<StoredFeedback[]>;
}

// Create feedback service
export function createFeedbackService(db: any): FeedbackService {
  return {
    db,

    async submitFeedback(feedback: MessageFeedback): Promise<StoredFeedback> {
      const validatedFeedback = MessageFeedback.parse(feedback);

      const feedbackData = {
        id: nanoid(),
        ...validatedFeedback,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const { feedback: feedbackTable } = await import('@/lib/db/schema');

      const [result] = await db
        .insert(feedbackTable)
        .values(feedbackData)
        .returning();

      return result as StoredFeedback;
    },

    async getFeedbackByRunId(runId: string): Promise<StoredFeedback[]> {
      try {
        const { feedback: feedbackTable } = await import('@/lib/db/schema');

        const results = await db
          .select()
          .from(feedbackTable)
          .where(eq(feedbackTable.runId, runId));

        return results as StoredFeedback[];
      } catch (_error) {
        return [];
      }
    },

    async getFeedbackByUserId(userId: string): Promise<StoredFeedback[]> {
      try {
        const { feedback: feedbackTable } = await import('@/lib/db/schema');

        const results = await db
          .select()
          .from(feedbackTable)
          .where(eq(feedbackTable.userId, userId));

        return results as StoredFeedback[];
      } catch (_error) {
        return [];
      }
    },

    async updateFeedback(
      id: string,
      updates: FeedbackUpdate,
    ): Promise<StoredFeedback> {
      const validatedUpdates = FeedbackUpdate.parse(updates);
      const { feedback: feedbackTable } = await import('@/lib/db/schema');

      const [result] = await db
        .update(feedbackTable)
        .set({
          ...validatedUpdates,
          updatedAt: new Date(),
        })
        .where(eq(feedbackTable.id, id))
        .returning();

      return result as StoredFeedback;
    },

    async deleteFeedback(id: string): Promise<boolean> {
      try {
        const { feedback: feedbackTable } = await import('@/lib/db/schema');

        await db.delete(feedbackTable).where(eq(feedbackTable.id, id));

        return true;
      } catch (_error) {
        return false;
      }
    },

    async getStats(runId: string): Promise<FeedbackStats> {
      try {
        const feedbackList = await this.getFeedbackByRunId(runId);

        const stats = {
          total: feedbackList.length,
          upvotes: feedbackList.filter((f) => f.vote === 'up').length,
          downvotes: feedbackList.filter((f) => f.vote === 'down').length,
          ratio:
            feedbackList.length > 0
              ? feedbackList.filter((f) => f.vote === 'up').length /
                feedbackList.length
              : 0,
          hasComments: feedbackList.filter(
            (f) => f.comment && f.comment.trim().length > 0,
          ).length,
        };

        return FeedbackStats.parse(stats);
      } catch (_error) {
        return {
          total: 0,
          upvotes: 0,
          downvotes: 0,
          ratio: 0,
          hasComments: 0,
        };
      }
    },

    async submitBatch(
      feedbackList: MessageFeedback[],
    ): Promise<StoredFeedback[]> {
      const validatedFeedbackList = feedbackList.map((f) =>
        MessageFeedback.parse(f),
      );
      const { feedback: feedbackTable } = await import('@/lib/db/schema');

      const feedbackData = validatedFeedbackList.map((feedback) => ({
        id: nanoid(),
        ...feedback,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const results = await db
        .insert(feedbackTable)
        .values(feedbackData)
        .returning();

      return results as StoredFeedback[];
    },
  };
}

// Helper functions
export async function submitFeedback(
  service: FeedbackService,
  feedback: MessageFeedback,
): Promise<StoredFeedback> {
  return await service.submitFeedback(feedback);
}

export async function getFeedbackByRunId(
  service: FeedbackService,
  runId: string,
): Promise<StoredFeedback[]> {
  return await service.getFeedbackByRunId(runId);
}

export async function updateFeedback(
  service: FeedbackService,
  id: string,
  updates: FeedbackUpdate,
): Promise<StoredFeedback> {
  return await service.updateFeedback(id, updates);
}

// Check if user has already voted on a message
export async function hasUserVoted(
  service: FeedbackService,
  messageId: string,
  userId: string,
): Promise<StoredFeedback | null> {
  try {
    const { feedback: feedbackTable } = await import('@/lib/db/schema');

    const [result] = await service.db
      .select()
      .from(feedbackTable)
      .where(
        and(
          eq(feedbackTable.messageId, messageId),
          eq(feedbackTable.userId, userId),
        ),
      )
      .limit(1);

    return result || null;
  } catch (_error) {
    return null;
  }
}

// Get feedback statistics for a list of run IDs
export async function getBatchStats(
  service: FeedbackService,
  runIds: string[],
): Promise<Record<string, FeedbackStats>> {
  const stats: Record<string, FeedbackStats> = {};

  await Promise.all(
    runIds.map(async (runId) => {
      stats[runId] = await service.getStats(runId);
    }),
  );

  return stats;
}

// Export singleton service
let feedbackService: FeedbackService | null = null;

export async function getFeedbackService(): Promise<FeedbackService> {
  if (!feedbackService) {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    // Use validated environment variable
    const client = postgres(POSTGRES_URL);
    const db = drizzle(client);
    feedbackService = createFeedbackService(db);
  }

  return feedbackService;
}
