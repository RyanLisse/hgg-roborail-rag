'use client';

import { useEffect, useState } from 'react';
import { StreamingMessage } from './streaming-message';
import { Markdown } from './markdown';
import { sanitizeText } from '@/lib/utils';

interface StreamingTextProps {
  content: string;
  isLoading: boolean;
  enableStreaming?: boolean;
  enableMarkdown?: boolean;
  streamingSpeed?: number;
  className?: string;
}

/**
 * Enhanced text component that automatically streams content when loading
 * Integrates with existing message system for smooth typewriter effects
 */
export function StreamingText({
  content,
  isLoading,
  enableStreaming = true,
  enableMarkdown = true,
  streamingSpeed = 8, // Slightly faster than ContentPort for better UX
  className = '',
}: StreamingTextProps) {
  const [shouldStream, setShouldStream] = useState(false);
  const [previousContent, setPreviousContent] = useState('');

  useEffect(() => {
    // Only stream if content is new and longer than previous
    const isNewContent = content !== previousContent && content.length > previousContent.length;
    const isSignificantContent = content.length > 20; // Stream only for substantial content
    
    if (isLoading && isNewContent && isSignificantContent && enableStreaming) {
      setShouldStream(true);
      setPreviousContent(content);
    } else {
      setShouldStream(false);
    }
  }, [content, isLoading, previousContent, enableStreaming]);

  // For final/static content or when streaming is disabled
  if (!shouldStream || !enableStreaming) {
    return (
      <div className={className}>
        {enableMarkdown ? (
          <Markdown>{sanitizeText(content)}</Markdown>
        ) : (
          <div className="whitespace-pre-wrap">{sanitizeText(content)}</div>
        )}
      </div>
    );
  }

  // For streaming content
  return (
    <StreamingMessage
      content={sanitizeText(content)}
      isStreaming={shouldStream}
      speed={streamingSpeed}
      enableMarkdown={enableMarkdown}
      className={className}
      onComplete={() => setShouldStream(false)}
    />
  );
}

/**
 * Hook to manage streaming state across message components
 */
export function useStreamingState(isLoading: boolean, content: string) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  useEffect(() => {
    if (isLoading && content && content.length > streamingContent.length) {
      setIsStreaming(true);
      setStreamingContent(content);
    } else if (!isLoading) {
      setIsStreaming(false);
      setStreamingContent(content);
    }
  }, [isLoading, content, streamingContent.length]);

  return {
    isStreaming,
    streamingContent,
    setIsStreaming,
  };
}

/**
 * Progressive text reveal component for reasoning/thinking content
 * Shows content in stages with smooth transitions
 */
interface ProgressiveTextProps {
  content: string;
  isLoading: boolean;
  stages?: string[];
  stageInterval?: number;
  className?: string;
}

export function ProgressiveText({
  content,
  isLoading,
  stages = ['Analyzing...', 'Processing...', 'Finalizing...'],
  stageInterval = 1500,
  className = '',
}: ProgressiveTextProps) {
  const [currentStage, setCurrentStage] = useState(0);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowContent(true);
      return;
    }

    const intervals: NodeJS.Timeout[] = [];
    
    stages.forEach((_, index) => {
      const timeout = setTimeout(() => {
        setCurrentStage(index);
      }, index * stageInterval);
      intervals.push(timeout);
    });

    // Show final content after all stages
    const finalTimeout = setTimeout(() => {
      setShowContent(true);
    }, stages.length * stageInterval);
    intervals.push(finalTimeout);

    return () => {
      intervals.forEach(clearTimeout);
    };
  }, [isLoading, stages, stageInterval]);

  if (showContent && content) {
    return (
      <StreamingText
        content={content}
        isLoading={isLoading}
        enableStreaming={true}
        className={className}
      />
    );
  }

  if (isLoading) {
    return (
      <div className={`text-muted-foreground ${className}`}>
        {stages[currentStage] || stages[0]}
      </div>
    );
  }

  return (
    <div className={className}>
      <Markdown>{sanitizeText(content)}</Markdown>
    </div>
  );
}