"use client";

import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import ThumbsDown from "lucide-react/dist/esm/icons/thumbs-down";
import ThumbsUp from "lucide-react/dist/esm/icons/thumbs-up";
import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFeedback } from "@/hooks/use-feedback";
import { cn } from "@/lib/utils";

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
  className,
}: MessageFeedbackProps) {
  const [showCommentDialog, setShowCommentDialog] = useState(false);

  const {
    submitFeedback,
    updateFeedback,
    existingFeedback,
    isSubmitting,
    error,
  } = useFeedback(messageId, userId);

  const handleVote = async (vote: "up" | "down") => {
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

  const handleCommentSubmit = async (data: {
    vote: "up" | "down";
    comment: string;
  }) => {
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
    <div className={cn("flex items-center gap-2", className)}>
      {/* Voting Buttons */}
      <div className="flex items-center gap-1">
        <Button
          aria-label="Thumbs up"
          className={cn(
            "h-8 w-8 p-0",
            existingFeedback?.vote === "up" &&
              "bg-green-100 text-green-700 hover:bg-green-200",
          )}
          disabled={isSubmitting}
          onClick={() => handleVote("up")}
          size="sm"
          variant="ghost"
        >
          <ThumbsUp size={16} />
        </Button>

        <Button
          aria-label="Thumbs down"
          className={cn(
            "h-8 w-8 p-0",
            existingFeedback?.vote === "down" &&
              "bg-red-100 text-red-700 hover:bg-red-200",
          )}
          disabled={isSubmitting}
          onClick={() => handleVote("down")}
          size="sm"
          variant="ghost"
        >
          <ThumbsDown size={16} />
        </Button>
      </div>

      {/* Comment Button */}
      {existingFeedback && (
        <Button
          aria-label="Add comment"
          className="h-8 px-2 text-xs"
          disabled={isSubmitting}
          onClick={() => setShowCommentDialog(true)}
          size="sm"
          variant="ghost"
        >
          <MessageSquare className="mr-1" size={14} />
          {existingFeedback.comment ? "Edit" : "Comment"}
        </Button>
      )}

      {/* Comment Badge */}
      {existingFeedback?.comment && (
        <Badge className="px-2 py-1 text-xs" variant="secondary">
          <MessageSquare className="mr-1" size={12} />
          Comment added
        </Badge>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-center text-destructive text-xs">
          <AlertCircle className="mr-1" size={12} />
          {error.message}
        </div>
      )}

      {/* Comment Dialog */}
      <FeedbackDialog
        initialComment={existingFeedback?.comment || ""}
        initialVote={existingFeedback?.vote || "up"}
        isOpen={showCommentDialog}
        onClose={() => setShowCommentDialog(false)}
        onSubmit={handleCommentSubmit}
      />
    </div>
  );
}

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { vote: "up" | "down"; comment: string }) => void;
  initialVote: "up" | "down";
  initialComment: string;
}

export function FeedbackDialog({
  isOpen,
  onClose,
  onSubmit,
  initialVote,
  initialComment,
}: FeedbackDialogProps) {
  const [vote, setVote] = useState<"up" | "down">(initialVote);
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
    <AlertDialog onOpenChange={handleClose} open={isOpen}>
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
            <label className="font-medium text-sm" htmlFor="rating-buttons">
              Rating
            </label>
            <div className="flex gap-2" id="rating-buttons">
              <Button
                aria-label="Thumbs up"
                className={cn(
                  "flex items-center gap-2",
                  vote === "up" &&
                    "border-green-300 bg-green-100 text-green-700",
                )}
                onClick={() => setVote("up")}
                size="sm"
                type="button"
                variant="outline"
              >
                <ThumbsUp size={16} />
                Helpful
              </Button>
              <Button
                aria-label="Thumbs down"
                className={cn(
                  "flex items-center gap-2",
                  vote === "down" && "border-red-300 bg-red-100 text-red-700",
                )}
                onClick={() => setVote("down")}
                size="sm"
                type="button"
                variant="outline"
              >
                <ThumbsDown size={16} />
                Not helpful
              </Button>
            </div>
          </div>

          {/* Comment Input */}
          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="comment">
              Comment (optional)
            </label>
            <Textarea
              aria-label="Comment"
              className="min-h-[80px] resize-none"
              id="comment"
              maxLength={500}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share what was helpful or how we can improve..."
              value={comment}
            />
            <div className="text-right text-muted-foreground text-xs">
              {comment.length}/500
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!hasChanges} onClick={handleSubmit}>
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
    <div
      className={cn(
        "flex items-center gap-2 text-muted-foreground text-xs",
        className,
      )}
    >
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
