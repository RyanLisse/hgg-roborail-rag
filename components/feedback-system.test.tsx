import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MessageFeedback, FeedbackDialog } from './feedback-system';

// Mock the feedback hook
vi.mock('@/hooks/use-feedback', () => ({
  useFeedback: vi.fn(() => ({
    submitFeedback: vi.fn(),
    updateFeedback: vi.fn(),
    existingFeedback: null,
    isSubmitting: false,
    error: null,
  })),
}));

describe('Feedback System Components', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('MessageFeedback Component', () => {
    const defaultProps = {
      messageId: 'msg-123',
      runId: 'run-123',
      userId: 'user-123',
    };

    it('should render feedback buttons', () => {
      renderWithQueryClient(<MessageFeedback {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /thumbs up/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /thumbs down/i })).toBeInTheDocument();
    });

    it('should handle upvote click', async () => {
      const mockSubmitFeedback = vi.fn();
      vi.mocked(require('@/hooks/use-feedback').useFeedback).mockReturnValue({
        submitFeedback: mockSubmitFeedback,
        updateFeedback: vi.fn(),
        existingFeedback: null,
        isSubmitting: false,
        error: null,
      });

      renderWithQueryClient(<MessageFeedback {...defaultProps} />);
      
      const upvoteButton = screen.getByRole('button', { name: /thumbs up/i });
      fireEvent.click(upvoteButton);

      await waitFor(() => {
        expect(mockSubmitFeedback).toHaveBeenCalledWith({
          messageId: 'msg-123',
          runId: 'run-123',
          userId: 'user-123',
          vote: 'up',
        });
      });
    });

    it('should handle downvote click', async () => {
      const mockSubmitFeedback = vi.fn();
      vi.mocked(require('@/hooks/use-feedback').useFeedback).mockReturnValue({
        submitFeedback: mockSubmitFeedback,
        updateFeedback: vi.fn(),
        existingFeedback: null,
        isSubmitting: false,
        error: null,
      });

      renderWithQueryClient(<MessageFeedback {...defaultProps} />);
      
      const downvoteButton = screen.getByRole('button', { name: /thumbs down/i });
      fireEvent.click(downvoteButton);

      await waitFor(() => {
        expect(mockSubmitFeedback).toHaveBeenCalledWith({
          messageId: 'msg-123',
          runId: 'run-123',
          userId: 'user-123',
          vote: 'down',
        });
      });
    });

    it('should show existing feedback state', () => {
      vi.mocked(require('@/hooks/use-feedback').useFeedback).mockReturnValue({
        submitFeedback: vi.fn(),
        updateFeedback: vi.fn(),
        existingFeedback: {
          id: 'feedback-123',
          vote: 'up',
          comment: 'Great response!',
        },
        isSubmitting: false,
        error: null,
      });

      renderWithQueryClient(<MessageFeedback {...defaultProps} />);
      
      const upvoteButton = screen.getByRole('button', { name: /thumbs up/i });
      expect(upvoteButton).toHaveClass('bg-green-100'); // Active state
    });

    it('should disable buttons when submitting', () => {
      vi.mocked(require('@/hooks/use-feedback').useFeedback).mockReturnValue({
        submitFeedback: vi.fn(),
        updateFeedback: vi.fn(),
        existingFeedback: null,
        isSubmitting: true,
        error: null,
      });

      renderWithQueryClient(<MessageFeedback {...defaultProps} />);
      
      const upvoteButton = screen.getByRole('button', { name: /thumbs up/i });
      const downvoteButton = screen.getByRole('button', { name: /thumbs down/i });
      
      expect(upvoteButton).toBeDisabled();
      expect(downvoteButton).toBeDisabled();
    });

    it('should show comment button when feedback exists', () => {
      vi.mocked(require('@/hooks/use-feedback').useFeedback).mockReturnValue({
        submitFeedback: vi.fn(),
        updateFeedback: vi.fn(),
        existingFeedback: {
          id: 'feedback-123',
          vote: 'up',
          comment: 'Great response!',
        },
        isSubmitting: false,
        error: null,
      });

      renderWithQueryClient(<MessageFeedback {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /add comment/i })).toBeInTheDocument();
    });
  });

  describe('FeedbackDialog Component', () => {
    const defaultProps = {
      isOpen: true,
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      initialVote: 'up' as const,
      initialComment: '',
    };

    it('should render dialog with vote and comment fields', () => {
      renderWithQueryClient(<FeedbackDialog {...defaultProps} />);
      
      expect(screen.getByText(/provide feedback/i)).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should handle comment submission', async () => {
      const mockOnSubmit = vi.fn();
      
      renderWithQueryClient(
        <FeedbackDialog {...defaultProps} onSubmit={mockOnSubmit} />
      );
      
      const commentInput = screen.getByRole('textbox', { name: /comment/i });
      const submitButton = screen.getByRole('button', { name: /submit/i });
      
      fireEvent.change(commentInput, { target: { value: 'This is helpful' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          vote: 'up',
          comment: 'This is helpful',
        });
      });
    });

    it('should handle vote change in dialog', () => {
      renderWithQueryClient(<FeedbackDialog {...defaultProps} />);
      
      const downvoteButton = screen.getByRole('button', { name: /thumbs down/i });
      fireEvent.click(downvoteButton);
      
      // Check that downvote button is now active
      expect(downvoteButton).toHaveClass('bg-red-100');
    });

    it('should populate initial values', () => {
      renderWithQueryClient(
        <FeedbackDialog 
          {...defaultProps} 
          initialVote="down"
          initialComment="Needs improvement"
        />
      );
      
      const commentInput = screen.getByRole('textbox', { name: /comment/i });
      expect(commentInput).toHaveValue('Needs improvement');
      
      const downvoteButton = screen.getByRole('button', { name: /thumbs down/i });
      expect(downvoteButton).toHaveClass('bg-red-100');
    });

    it('should handle cancel action', () => {
      const mockOnClose = vi.fn();
      
      renderWithQueryClient(
        <FeedbackDialog {...defaultProps} onClose={mockOnClose} />
      );
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should disable submit when no changes made', () => {
      renderWithQueryClient(
        <FeedbackDialog 
          {...defaultProps} 
          initialVote="up"
          initialComment=""
        />
      );
      
      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit when comment is added', () => {
      renderWithQueryClient(<FeedbackDialog {...defaultProps} />);
      
      const commentInput = screen.getByRole('textbox', { name: /comment/i });
      const submitButton = screen.getByRole('button', { name: /submit/i });
      
      fireEvent.change(commentInput, { target: { value: 'Good response' } });
      
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when feedback submission fails', () => {
      vi.mocked(require('@/hooks/use-feedback').useFeedback).mockReturnValue({
        submitFeedback: vi.fn(),
        updateFeedback: vi.fn(),
        existingFeedback: null,
        isSubmitting: false,
        error: new Error('Failed to submit feedback'),
      });

      renderWithQueryClient(
        <MessageFeedback messageId="msg-123" runId="run-123" userId="user-123" />
      );
      
      expect(screen.getByText(/failed to submit feedback/i)).toBeInTheDocument();
    });
  });
});