import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  type LangSmithService,
  createLangSmithService,
  trackRagGeneration,
  submitUserFeedback,
  type UserFeedback,
} from './langsmith';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-run-id'),
});

// Mock LangSmith client
vi.mock('langsmith', () => ({
  Client: vi.fn().mockImplementation(() => ({
    createRun: vi.fn().mockResolvedValue({ id: 'test-run-id' }),
    updateRun: vi.fn().mockResolvedValue(true),
    createFeedback: vi.fn().mockResolvedValue({ id: 'test-feedback-id' }),
  })),
  traceable: vi.fn().mockImplementation((fn) => fn),
}));

describe('LangSmith Service', () => {
  let langSmithService: LangSmithService;

  beforeEach(() => {
    langSmithService = createLangSmithService({
      apiKey: 'test-api-key',
      projectName: 'test-rag-app',
    });
  });

  describe('Service Creation', () => {
    it('should create LangSmith service with valid configuration', () => {
      expect(langSmithService).toBeDefined();
      expect(langSmithService.isEnabled).toBe(true);
    });

    it('should handle missing API key gracefully', () => {
      const service = createLangSmithService({
        apiKey: '',
        projectName: 'test-project',
      });

      expect(service.isEnabled).toBe(false);
    });
  });

  describe('RAG Generation Tracking', () => {
    it('should track RAG generation with proper metadata', async () => {
      const ragData = {
        question: 'What is React?',
        answer: 'React is a JavaScript library for building user interfaces.',
        sources: [
          {
            documentId: 'doc-1',
            content: 'React documentation...',
            score: 0.95,
            metadata: { title: 'React Docs' },
          },
        ],
        model: 'openai-gpt-4.1',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      };

      const runId = await trackRagGeneration(langSmithService, ragData);

      expect(runId).toBe('test-run-id');
      expect(langSmithService.client.createRun).toHaveBeenCalledWith({
        id: 'test-run-id',
        name: 'rag_generation',
        run_type: 'chain',
        inputs: {
          question: ragData.question,
          sources: ragData.sources,
          model: ragData.model,
        },
        outputs: {
          answer: ragData.answer,
        },
        extra: {
          metadata: {
            sources_count: 1,
            model: ragData.model,
            usage: ragData.usage,
            timestamp: expect.any(Number),
          },
          tags: ['rag', 'generation'],
        },
        project_name: 'test-rag-app',
      });
    });

    it('should handle tracking errors gracefully', async () => {
      langSmithService.client.createRun = vi
        .fn()
        .mockRejectedValue(new Error('API Error'));

      const ragData = {
        question: 'Test question',
        answer: 'Test answer',
        sources: [],
        model: 'test-model',
      };

      const runId = await trackRagGeneration(langSmithService, ragData);
      expect(runId).toBeNull();
    });
  });

  describe('User Feedback', () => {
    it('should submit positive feedback with comment', async () => {
      const feedback: UserFeedback = {
        runId: 'test-run-id',
        score: 1,
        value: 'thumbs_up',
        comment: 'Great response!',
        userId: 'user-123',
      };

      const feedbackId = await submitUserFeedback(langSmithService, feedback);

      expect(feedbackId).toBe('test-run-id'); // submitUserFeedback returns the runId
      expect(langSmithService.client.createFeedback).toHaveBeenCalledWith(
        'test-run-id',
        'user_feedback',
        {
          score: 1,
          value: 'thumbs_up',
          comment: 'Great response!',
        },
      );
    });

    it('should submit negative feedback without comment', async () => {
      const feedback: UserFeedback = {
        runId: 'test-run-id',
        score: 0,
        value: 'thumbs_down',
        userId: 'user-123',
      };

      const feedbackId = await submitUserFeedback(langSmithService, feedback);

      expect(feedbackId).toBe('test-run-id'); // submitUserFeedback returns the runId
      expect(langSmithService.client.createFeedback).toHaveBeenCalledWith(
        'test-run-id',
        'user_feedback',
        {
          score: 0,
          value: 'thumbs_down',
          comment: undefined,
        },
      );
    });

    it('should handle feedback submission errors', async () => {
      langSmithService.client.createFeedback = vi
        .fn()
        .mockRejectedValue(new Error('Feedback Error'));

      const feedback: UserFeedback = {
        runId: 'test-run-id',
        score: 1,
        value: 'thumbs_up',
        userId: 'user-123',
      };

      const feedbackId = await submitUserFeedback(langSmithService, feedback);
      expect(feedbackId).toBeNull();
    });
  });

  describe('Disabled Service', () => {
    beforeEach(() => {
      langSmithService = createLangSmithService({
        apiKey: '',
        projectName: 'test-project',
      });
    });

    it('should not track when service is disabled', async () => {
      const ragData = {
        question: 'Test',
        answer: 'Test',
        sources: [],
        model: 'test-model',
      };

      const runId = await trackRagGeneration(langSmithService, ragData);
      expect(runId).toBeNull();
    });

    it('should not submit feedback when service is disabled', async () => {
      const feedback: UserFeedback = {
        runId: 'test-run-id',
        score: 1,
        value: 'thumbs_up',
        userId: 'user-123',
      };

      const feedbackId = await submitUserFeedback(langSmithService, feedback);
      expect(feedbackId).toBeNull();
    });
  });
});
