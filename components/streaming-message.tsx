'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Markdown } from './markdown';

interface StreamingMessageProps {
  content: string;
  isStreaming?: boolean;
  speed?: number;
  onComplete?: () => void;
  enableMarkdown?: boolean;
  className?: string;
}

/**
 * Enhanced streaming message component with typewriter effect
 * Inspired by ContentPort's implementation with performance optimizations
 */
export function StreamingMessage({
  content,
  isStreaming = false,
  speed = 5, // milliseconds per character
  onComplete,
  enableMarkdown = true,
  className = '',
}: StreamingMessageProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const animationFrameRef = useRef<number>();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const indexRef = useRef(0);

  const startAnimation = useCallback(() => {
    if (!content || !isStreaming) {
      setDisplayedContent(content);
      return;
    }

    setIsAnimating(true);
    indexRef.current = 0;
    setDisplayedContent('');

    const animate = () => {
      if (indexRef.current < content.length) {
        const nextChar = content[indexRef.current];
        setDisplayedContent(prev => prev + nextChar);
        indexRef.current++;

        timeoutRef.current = setTimeout(() => {
          animationFrameRef.current = requestAnimationFrame(animate);
        }, speed);
      } else {
        setIsAnimating(false);
        onComplete?.();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [content, isStreaming, speed, onComplete]);

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setDisplayedContent(content);
    setIsAnimating(false);
    onComplete?.();
  }, [content, onComplete]);

  useEffect(() => {
    startAnimation();
    return stopAnimation;
  }, [startAnimation, stopAnimation]);

  // Click to complete animation quickly
  const handleClick = useCallback(() => {
    if (isAnimating) {
      stopAnimation();
    }
  }, [isAnimating, stopAnimation]);

  const motionVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  };

  return (
    <motion.div
      variants={motionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={className}
      onClick={handleClick}
      style={{ cursor: isAnimating ? 'pointer' : 'default' }}
    >
      {enableMarkdown ? (
        <Markdown>{displayedContent}</Markdown>
      ) : (
        <div className="whitespace-pre-wrap">{displayedContent}</div>
      )}
      
      {/* Animated cursor */}
      {isAnimating && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          className="inline-block w-0.5 h-4 bg-current ml-0.5"
        />
      )}
    </motion.div>
  );
}

/**
 * Hook for managing streaming text state
 * Provides reset functionality and streaming control
 */
export function useStreamingText(initialContent = '') {
  const [content, setContent] = useState(initialContent);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStreaming = useCallback((newContent: string) => {
    setContent(newContent);
    setIsStreaming(true);
  }, []);

  const stopStreaming = useCallback(() => {
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setContent('');
    setIsStreaming(false);
  }, []);

  return {
    content,
    isStreaming,
    startStreaming,
    stopStreaming,
    reset,
    setContent,
  };
}