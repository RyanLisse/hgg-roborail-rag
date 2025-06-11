'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useFeedback } from '@/hooks/use-feedback';
import { ThumbsUp, ThumbsDown, MessageSquare, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageFeedbackProps {
  messageId: string;
  runId: string;
  userId: string;
  className?: string;
}

export function MessageFeedback({ 
  messageId, 
  runId, 
  userId, 
  className 
}: MessageFeedbackProps) {
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  
  const {
    submitFeedback,
    updateFeedback,
    existingFeedback,
    isSubmitting,
    error,
  } = useFeedback(messageId, userId);

  const handleVote = async (vote: 'up' | 'down') => {
    if (existingFeedback) {
      if (existingFeedback.vote === vote) {
        // Same vote clicked - show comment dialog
        setShowCommentDialog(true);
      } else {
        // Different vote - update
        await updateFeedback({
          vote,
          comment: existingFeedback.comment,
        });
      }
    } else {
      // New vote
      await submitFeedback({
        messageId,
        runId,
        userId,
        vote,
      });
    }
  };

  const handleCommentSubmit = async (data: { vote: 'up' | 'down'; comment: string }) => {
    if (existingFeedback) {
      await updateFeedback(data);
    } else {
      await submitFeedback({
        messageId,
        runId,
        userId,
        ...data,
      });
    }
    setShowCommentDialog(false);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Voting Buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleVote('up')}
          disabled={isSubmitting}
          className={cn(
            'h-8 w-8 p-0',
            existingFeedback?.vote === 'up' && 'bg-green-100 text-green-700 hover:bg-green-200'
          )}
          aria-label="Thumbs up"
        >
          <ThumbsUp size={16} />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleVote('down')}
          disabled={isSubmitting}
          className={cn(
            'h-8 w-8 p-0',
            existingFeedback?.vote === 'down' && 'bg-red-100 text-red-700 hover:bg-red-200'
          )}
          aria-label="Thumbs down"
        >
          <ThumbsDown size={16} />
        </Button>
      </div>

      {/* Comment Button */}
      {existingFeedback && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCommentDialog(true)}
          disabled={isSubmitting}
          className="h-8 px-2 text-xs"
          aria-label="Add comment"
        >
          <MessageSquare size={14} className="mr-1" />
          {existingFeedback.comment ? 'Edit' : 'Comment'}
        </Button>
      )}

      {/* Comment Badge */}
      {existingFeedback?.comment && (
        <Badge variant="secondary" className="text-xs px-2 py-1">
          <MessageSquare size={12} className="mr-1" />
          Comment added
        </Badge>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-center text-destructive text-xs">
          <AlertCircle size={12} className="mr-1" />
          {error.message}
        </div>
      )}

      {/* Comment Dialog */}
      <FeedbackDialog
        isOpen={showCommentDialog}
        onClose={() => setShowCommentDialog(false)}
        onSubmit={handleCommentSubmit}
        initialVote={existingFeedback?.vote || 'up'}
        initialComment={existingFeedback?.comment || ''}
      />
    </div>
  );
}

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { vote: 'up' | 'down'; comment: string }) => void;
  initialVote: 'up' | 'down';
  initialComment: string;
}

export function FeedbackDialog({
  isOpen,
  onClose,
  onSubmit,
  initialVote,
  initialComment,
}: FeedbackDialogProps) {
  const [vote, setVote] = useState<'up' | 'down'>(initialVote);
  const [comment, setComment] = useState(initialComment);

  const hasChanges = vote !== initialVote || comment !== initialComment;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ vote, comment: comment.trim() });
  };

  const handleClose = () => {
    setVote(initialVote);
    setComment(initialComment);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Provide Feedback</AlertDialogTitle>
          <AlertDialogDescription>
            Help us improve by sharing your thoughts on this response.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Vote Selection */}
          <div className="space-y-2">
            <label htmlFor="rating-buttons" className="text-sm font-medium">Rating</label>
            <div id="rating-buttons" className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVote('up')}
                className={cn(
                  'flex items-center gap-2',
                  vote === 'up' && 'bg-green-100 text-green-700 border-green-300'
                )}
                aria-label="Thumbs up"
              >
                <ThumbsUp size={16} />
                Helpful
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVote('down')}
                className={cn(
                  'flex items-center gap-2',
                  vote === 'down' && 'bg-red-100 text-red-700 border-red-300'
                )}
                aria-label="Thumbs down"
              >
                <ThumbsDown size={16} />
                Not helpful
              </Button>
            </div>
          </div>

          {/* Comment Input */}
          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              Comment (optional)
            </label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share what was helpful or how we can improve..."
              className="min-h-[80px] resize-none"
              maxLength={500}
              aria-label="Comment"
            />
            <div className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={!hasChanges}
          >
            Submit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface FeedbackStatsProps {
  runId: string;
  className?: string;
}

export function FeedbackStats({ runId, className }: FeedbackStatsProps) {
  // This would fetch stats for the runId
  // For now, we'll show a placeholder
  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <div className="flex items-center gap-1">
        <ThumbsUp size={12} />
        <span>5</span>
      </div>
      <div className="flex items-center gap-1">
        <ThumbsDown size={12} />
        <span>1</span>
      </div>
      <div className="flex items-center gap-1">
        <MessageSquare size={12} />
        <span>3 comments</span>
      </div>
    </div>
  );
}