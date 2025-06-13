import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  type FeedbackService,
  createFeedbackService,
  submitFeedback,
  getFeedbackByRunId,
  updateFeedback,
  type MessageFeedback,
} from './feedback';

// Mock database
const mockDb = {
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'feedback-123' }]),
    }),
  }),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ id: 'feedback-123' }]),
    }),
  }),
};

vi.mock('@/lib/db/schema', () => ({
  feedback: {},
}));

describe('Feedback Service', () => {
  let feedbackService: FeedbackService;

  beforeEach(() => {
    feedbackService = createFeedbackService(mockDb as any);
    vi.clearAllMocks();
  });

  describe('Service Creation', () => {
    it('should create feedback service with valid database', () => {
      expect(feedbackService).toBeDefined();
      expect(feedbackService.db).toBeDefined();
    });
  });

  describe('Submit Feedback', () => {
    it('should submit positive feedback with comment', async () => {
      const feedback: MessageFeedback = {
        runId: 'run-123',
        messageId: 'msg-123',
        userId: 'user-123',
        vote: 'up',
        comment: 'Great response!',
        metadata: {
          model: 'openai-gpt-4.1',
          responseTime: 1500,
        },
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'feedback-123',
              ...feedback,
              createdAt: new Date(),
            },
          ]),
        }),
      });

      const result = await submitFeedback(feedbackService, feedback);

      expect(result).toBeDefined();
      expect(result.id).toBe('feedback-123');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should submit negative feedback without comment', async () => {
      const feedback: MessageFeedback = {
        runId: 'run-123',
        messageId: 'msg-123',
        userId: 'user-123',
        vote: 'down',
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'feedback-124',
              ...feedback,
              createdAt: new Date(),
            },
          ]),
        }),
      });

      const result = await submitFeedback(feedbackService, feedback);

      expect(result).toBeDefined();
      expect(result.id).toBe('feedback-124');
      expect(result.vote).toBe('down');
    });

    it('should validate feedback data', async () => {
      const invalidFeedback = {
        runId: '', // Invalid empty runId
        messageId: 'msg-123',
        userId: 'user-123',
        vote: 'invalid' as any, // Invalid vote value
      };

      await expect(
        submitFeedback(feedbackService, invalidFeedback),
      ).rejects.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      const feedback: MessageFeedback = {
        runId: 'run-123',
        messageId: 'msg-123',
        userId: 'user-123',
        vote: 'up',
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      await expect(submitFeedback(feedbackService, feedback)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('Get Feedback', () => {
    it('should retrieve feedback by run ID', async () => {
      const mockFeedback = [
        {
          id: 'feedback-123',
          runId: 'run-123',
          messageId: 'msg-123',
          userId: 'user-123',
          vote: 'up',
          comment: 'Great response!',
          createdAt: new Date(),
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFeedback),
        }),
      });

      const result = await getFeedbackByRunId(feedbackService, 'run-123');

      expect(result).toEqual(mockFeedback);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return empty array for non-existent run ID', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await getFeedbackByRunId(feedbackService, 'non-existent');

      expect(result).toEqual([]);
    });
  });

  describe('Update Feedback', () => {
    it('should update existing feedback', async () => {
      const updates = {
        comment: 'Updated comment',
        metadata: { updated: true },
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'feedback-123',
              comment: 'Updated comment',
              metadata: { updated: true },
            },
          ]),
        }),
      });

      const result = await updateFeedback(
        feedbackService,
        'feedback-123',
        updates,
      );

      expect(result).toBeDefined();
      expect(result.comment).toBe('Updated comment');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Update failed')),
        }),
      });

      await expect(
        updateFeedback(feedbackService, 'feedback-123', {}),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('Feedback Stats', () => {
    it('should calculate feedback statistics', async () => {
      const mockFeedback = [
        { vote: 'up', createdAt: new Date() },
        { vote: 'up', createdAt: new Date() },
        { vote: 'down', createdAt: new Date() },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFeedback),
        }),
      });

      const stats = await feedbackService.getStats('run-123');

      expect(stats).toEqual({
        total: 3,
        upvotes: 2,
        downvotes: 1,
        ratio: 2 / 3,
        hasComments: 0,
      });
    });

    it('should handle empty feedback', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const stats = await feedbackService.getStats('empty-run');

      expect(stats).toEqual({
        total: 0,
        upvotes: 0,
        downvotes: 0,
        ratio: 0,
        hasComments: 0,
      });
    });
  });

  describe('Batch Operations', () => {
    it('should submit multiple feedback items', async () => {
      const feedbackList: MessageFeedback[] = [
        {
          runId: 'run-1',
          messageId: 'msg-1',
          userId: 'user-1',
          vote: 'up',
        },
        {
          runId: 'run-2',
          messageId: 'msg-2',
          userId: 'user-2',
          vote: 'down',
        },
      ];

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: 'feedback-1', ...feedbackList[0] },
            { id: 'feedback-2', ...feedbackList[1] },
          ]),
        }),
      });

      const results = await feedbackService.submitBatch(feedbackList);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('feedback-1');
      expect(results[1].id).toBe('feedback-2');
    });
  });
});
