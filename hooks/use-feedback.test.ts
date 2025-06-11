import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFeedback } from './use-feedback';
import type { ReactNode } from 'react';

// Mock the feedback service
vi.mock('@/lib/feedback/feedback', () => ({
  getFeedbackService: vi.fn(() => ({
    submitFeedback: vi.fn().mockResolvedValue({
      id: 'feedback-123',
      vote: 'up',
      comment: 'Great response!',
    }),
    updateFeedback: vi.fn().mockResolvedValue({
      id: 'feedback-123',
      vote: 'down',
      comment: 'Updated comment',
    }),
    getFeedbackByRunId: vi.fn().mockResolvedValue([]),
  })),
  hasUserVoted: vi.fn().mockResolvedValue(null),
}));

// Mock LangSmith service
vi.mock('@/lib/observability/langsmith', () => ({
  getLangSmithService: vi.fn(() => ({
    isEnabled: true,
  })),
  submitUserFeedback: vi.fn().mockResolvedValue('langsmith-feedback-id'),
}));

describe('useFeedback Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useFeedback('msg-123', 'user-123'), { wrapper });

    expect(result.current.existingFeedback).toBe(null);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.submitFeedback).toBe('function');
    expect(typeof result.current.updateFeedback).toBe('function');
  });

  it('should load existing feedback on mount', async () => {
    vi.mocked(require('@/lib/feedback/feedback').hasUserVoted).mockResolvedValue({
      id: 'feedback-123',
      vote: 'up',
      comment: 'Great response!',
    });

    const { result } = renderHook(() => useFeedback('msg-123', 'user-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.existingFeedback).toEqual({
        id: 'feedback-123',
        vote: 'up',
        comment: 'Great response!',
      });
    });
  });

  it('should submit new feedback successfully', async () => {
    const { result } = renderHook(() => useFeedback('msg-123', 'user-123'), { wrapper });

    const feedbackData = {
      messageId: 'msg-123',
      runId: 'run-123',
      userId: 'user-123',
      vote: 'up' as const,
      comment: 'Helpful response',
    };

    await act(async () => {
      await result.current.submitFeedback(feedbackData);
    });

    expect(result.current.existingFeedback).toEqual({
      id: 'feedback-123',
      vote: 'up',
      comment: 'Great response!',
    });
  });

  it('should update existing feedback successfully', async () => {
    // Set up existing feedback
    vi.mocked(require('@/lib/feedback/feedback').hasUserVoted).mockResolvedValue({
      id: 'feedback-123',
      vote: 'up',
      comment: 'Great response!',
    });

    const { result } = renderHook(() => useFeedback('msg-123', 'user-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.existingFeedback).toBeDefined();
    });

    const updateData = {
      vote: 'down' as const,
      comment: 'Updated comment',
    };

    await act(async () => {
      await result.current.updateFeedback(updateData);
    });

    expect(result.current.existingFeedback).toEqual({
      id: 'feedback-123',
      vote: 'down',
      comment: 'Updated comment',
    });
  });

  it('should handle submission errors gracefully', async () => {
    vi.mocked(require('@/lib/feedback/feedback').getFeedbackService).mockReturnValue({
      submitFeedback: vi.fn().mockRejectedValue(new Error('Submission failed')),
      updateFeedback: vi.fn(),
      getFeedbackByRunId: vi.fn().mockResolvedValue([]),
    });

    const { result } = renderHook(() => useFeedback('msg-123', 'user-123'), { wrapper });

    const feedbackData = {
      messageId: 'msg-123',
      runId: 'run-123',
      userId: 'user-123',
      vote: 'up' as const,
    };

    await act(async () => {
      try {
        await result.current.submitFeedback(feedbackData);
      } catch (error) {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(new Error('Submission failed'));
    });
  });

  it('should handle update errors gracefully', async () => {
    // Set up existing feedback
    vi.mocked(require('@/lib/feedback/feedback').hasUserVoted).mockResolvedValue({
      id: 'feedback-123',
      vote: 'up',
      comment: 'Great response!',
    });

    vi.mocked(require('@/lib/feedback/feedback').getFeedbackService).mockReturnValue({
      submitFeedback: vi.fn(),
      updateFeedback: vi.fn().mockRejectedValue(new Error('Update failed')),
      getFeedbackByRunId: vi.fn().mockResolvedValue([]),
    });

    const { result } = renderHook(() => useFeedback('msg-123', 'user-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.existingFeedback).toBeDefined();
    });

    await act(async () => {
      try {
        await result.current.updateFeedback({ vote: 'down' });
      } catch (error) {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(new Error('Update failed'));
    });
  });

  it('should integrate with LangSmith when enabled', async () => {
    const mockSubmitUserFeedback = vi.fn().mockResolvedValue('langsmith-feedback-id');
    vi.mocked(require('@/lib/observability/langsmith').submitUserFeedback).mockImplementation(mockSubmitUserFeedback);

    const { result } = renderHook(() => useFeedback('msg-123', 'user-123'), { wrapper });

    const feedbackData = {
      messageId: 'msg-123',
      runId: 'run-123',
      userId: 'user-123',
      vote: 'up' as const,
      comment: 'Helpful response',
    };

    await act(async () => {
      await result.current.submitFeedback(feedbackData);
    });

    expect(mockSubmitUserFeedback).toHaveBeenCalledWith(
      expect.anything(), // LangSmith service
      {
        runId: 'run-123',
        score: 1, // up vote = 1
        value: 'thumbs_up',
        comment: 'Helpful response',
        userId: 'user-123',
      }
    );
  });

  it('should convert vote to LangSmith format correctly', async () => {
    const mockSubmitUserFeedback = vi.fn().mockResolvedValue('langsmith-feedback-id');
    vi.mocked(require('@/lib/observability/langsmith').submitUserFeedback).mockImplementation(mockSubmitUserFeedback);

    const { result } = renderHook(() => useFeedback('msg-123', 'user-123'), { wrapper });

    // Test downvote
    await act(async () => {
      await result.current.submitFeedback({
        messageId: 'msg-123',
        runId: 'run-123',
        userId: 'user-123',
        vote: 'down',
      });
    });

    expect(mockSubmitUserFeedback).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        score: 0, // down vote = 0
        value: 'thumbs_down',
      })
    );
  });

  it('should handle LangSmith errors gracefully', async () => {
    vi.mocked(require('@/lib/observability/langsmith').submitUserFeedback).mockRejectedValue(
      new Error('LangSmith error')
    );

    const { result } = renderHook(() => useFeedback('msg-123', 'user-123'), { wrapper });

    // Should still succeed even if LangSmith fails
    await act(async () => {
      await result.current.submitFeedback({
        messageId: 'msg-123',
        runId: 'run-123',
        userId: 'user-123',
        vote: 'up',
      });
    });

    expect(result.current.existingFeedback).toBeDefined();
    expect(result.current.error).toBeNull(); // LangSmith errors don't fail the main operation
  });

  it('should debounce rapid feedback submissions', async () => {
    const mockSubmitFeedback = vi.fn().mockResolvedValue({
      id: 'feedback-123',
      vote: 'up',
    });

    vi.mocked(require('@/lib/feedback/feedback').getFeedbackService).mockReturnValue({
      submitFeedback: mockSubmitFeedback,
      updateFeedback: vi.fn(),
      getFeedbackByRunId: vi.fn().mockResolvedValue([]),
    });

    const { result } = renderHook(() => useFeedback('msg-123', 'user-123'), { wrapper });

    const feedbackData = {
      messageId: 'msg-123',
      runId: 'run-123',
      userId: 'user-123',
      vote: 'up' as const,
    };

    // Submit multiple times rapidly
    await act(async () => {
      await Promise.all([
        result.current.submitFeedback(feedbackData),
        result.current.submitFeedback(feedbackData),
        result.current.submitFeedback(feedbackData),
      ]);
    });

    // Should only call the service once due to debouncing
    expect(mockSubmitFeedback).toHaveBeenCalledTimes(1);
  });
});