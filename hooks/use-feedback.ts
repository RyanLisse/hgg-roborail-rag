'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useDebounceCallback } from 'usehooks-ts';
import type {
  FeedbackUpdate,
  MessageFeedback,
  StoredFeedback,
} from '@/lib/feedback/feedback';
import {
  getLangSmithService,
  submitUserFeedback,
  type UserFeedback,
} from '@/lib/observability/langsmith';

export function useFeedback(messageId: string, userId: string) {
  const [error, setError] = useState<Error | null>(null);
  const queryClient = useQueryClient();

  // Query for existing feedback
  const { data: existingFeedback, isLoading } = useQuery<StoredFeedback | null>(
    {
      queryKey: ['feedback', messageId, userId],
      queryFn: async () => {
        const response = await fetch(`/api/feedback?messageId=${messageId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch feedback');
        }
        return await response.json();
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  );

  // Submit new feedback mutation
  const { mutate: submitFeedbackMutation, isPending: isSubmitting } =
    useMutation({
      mutationFn: async (
        feedback: MessageFeedback,
      ): Promise<StoredFeedback> => {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(feedback),
        });

        if (!response.ok) {
          throw new Error('Failed to submit feedback');
        }

        const result = await response.json();

        // Also submit to LangSmith if available
        try {
          const langSmithService = getLangSmithService();
          if (langSmithService.isEnabled && feedback.runId) {
            const langSmithFeedback: UserFeedback = {
              runId: feedback.runId,
              score: feedback.vote === 'up' ? 1 : 0,
              value: feedback.vote === 'up' ? 'thumbs_up' : 'thumbs_down',
              comment: feedback.comment,
              userId: feedback.userId,
            };

            await submitUserFeedback(langSmithService, langSmithFeedback);
          }
        } catch (_langSmithError) {
          // Don't fail the main operation if LangSmith fails
        }

        return result;
      },
      onSuccess: (data) => {
        queryClient.setQueryData(['feedback', messageId, userId], data);
        setError(null);
      },
      onError: (error: Error) => {
        setError(error);
      },
    });

  // Update existing feedback mutation
  const { mutate: updateFeedbackMutation, isPending: isUpdating } = useMutation(
    {
      mutationFn: async (updates: FeedbackUpdate): Promise<StoredFeedback> => {
        if (!existingFeedback) {
          throw new Error('No existing feedback to update');
        }

        const response = await fetch(
          `/api/feedback?id=${existingFeedback.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          },
        );

        if (!response.ok) {
          throw new Error('Failed to update feedback');
        }

        const result = await response.json();

        // Also update LangSmith if available
        try {
          const langSmithService = getLangSmithService();
          if (langSmithService.isEnabled && existingFeedback.runId) {
            const langSmithFeedback: UserFeedback = {
              runId: existingFeedback.runId,
              score: (updates.vote || existingFeedback.vote) === 'up' ? 1 : 0,
              value:
                (updates.vote || existingFeedback.vote) === 'up'
                  ? 'thumbs_up'
                  : 'thumbs_down',
              comment:
                updates.comment !== undefined
                  ? updates.comment
                  : existingFeedback.comment,
              userId: existingFeedback.userId,
            };

            await submitUserFeedback(langSmithService, langSmithFeedback);
          }
        } catch (_langSmithError) {}

        return result;
      },
      onSuccess: (data) => {
        queryClient.setQueryData(['feedback', messageId, userId], data);
        setError(null);
      },
      onError: (error: Error) => {
        setError(error);
      },
    },
  );

  // Debounced submit function to prevent rapid submissions
  const debouncedSubmit = useDebounceCallback((feedback: MessageFeedback) => {
    submitFeedbackMutation(feedback);
  }, 500);

  // Debounced update function
  const debouncedUpdate = useDebounceCallback((updates: FeedbackUpdate) => {
    updateFeedbackMutation(updates);
  }, 500);

  const submitFeedback = useCallback(
    async (feedback: MessageFeedback): Promise<void> => {
      return new Promise((resolve, reject) => {
        submitFeedbackMutation(feedback, {
          onSuccess: () => resolve(),
          onError: (error) => reject(error),
        });
      });
    },
    [submitFeedbackMutation],
  );

  const updateFeedback = useCallback(
    async (updates: FeedbackUpdate): Promise<void> => {
      return new Promise((resolve, reject) => {
        updateFeedbackMutation(updates, {
          onSuccess: () => resolve(),
          onError: (error) => reject(error),
        });
      });
    },
    [updateFeedbackMutation],
  );

  return {
    existingFeedback,
    isLoading,
    isSubmitting: isSubmitting || isUpdating,
    error,
    submitFeedback,
    updateFeedback,
    debouncedSubmit,
    debouncedUpdate,
  };
}

// Hook for feedback statistics
export function useFeedbackStats(runId: string) {
  return useQuery({
    queryKey: ['feedback-stats', runId],
    queryFn: async () => {
      const response = await fetch(`/api/feedback/stats?runId=${runId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch feedback stats');
      }
      return await response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!runId,
  });
}

// Hook for bulk feedback operations
export function useBulkFeedback() {
  const queryClient = useQueryClient();

  const { mutate: submitBulkFeedback, isPending: isSubmittingBulk } =
    useMutation({
      mutationFn: async (feedbackList: MessageFeedback[]) => {
        const response = await fetch('/api/feedback/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ feedbackList }),
        });

        if (!response.ok) {
          throw new Error('Failed to submit bulk feedback');
        }

        return await response.json();
      },
      onSuccess: (results: StoredFeedback[]) => {
        // Update cache for each feedback item
        results.forEach((feedback: StoredFeedback) => {
          queryClient.setQueryData(
            ['feedback', feedback.messageId, feedback.userId],
            feedback,
          );
        });
      },
    });

  return {
    submitBulkFeedback,
    isSubmittingBulk,
  };
}

// Hook for getting feedback by run ID
export function useRunFeedback(runId: string) {
  return useQuery({
    queryKey: ['run-feedback', runId],
    queryFn: async () => {
      const response = await fetch(`/api/feedback?runId=${runId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch run feedback');
      }
      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!runId,
  });
}

// Helper function to check if feedback exists
export function useFeedbackExists(messageId: string, userId: string): boolean {
  const { existingFeedback } = useFeedback(messageId, userId);
  return !!existingFeedback;
}

// Helper function to get feedback summary
export function useFeedbackSummary(runIds: string[]) {
  return useQuery({
    queryKey: ['feedback-summary', runIds],
    queryFn: async () => {
      const response = await fetch('/api/feedback/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ runIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch feedback summary');
      }

      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: runIds.length > 0,
  });
}
