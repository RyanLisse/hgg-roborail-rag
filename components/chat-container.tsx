'use client';

import { StickToBottom } from 'use-stick-to-bottom';
import { forwardRef, type RefObject } from 'react';
import { cn } from '@/lib/utils';

/**
 * Chat container components inspired by ContentPort's implementation
 * Uses use-stick-to-bottom for smooth auto-scrolling behavior
 */

interface ChatContainerProps {
  children: React.ReactNode;
  className?: string;
  resize?: 'smooth' | 'instant';
}

interface ChatContainerRootProps extends ChatContainerProps {
  role?: string;
  containerRef?: RefObject<HTMLDivElement | null>;
}

interface ChatContainerContentProps {
  children: React.ReactNode;
  className?: string;
}

interface ChatContainerScrollAnchorProps {
  className?: string;
}

/**
 * Root chat container with auto-scrolling functionality
 * Automatically sticks to bottom when new content is added
 */
const ChatContainerRoot = forwardRef<HTMLDivElement, ChatContainerRootProps>(
  ({ children, className, resize = 'smooth', role = 'log', containerRef, ...props }, ref) => {
    return (
      <div
        ref={containerRef || ref}
        className={cn(
          'flex flex-col overflow-y-auto',
          className
        )}
        role={role}
        {...props}
      >
        <StickToBottom resize={resize}>
          {children}
        </StickToBottom>
      </div>
    );
  }
);
ChatContainerRoot.displayName = 'ChatContainerRoot';

/**
 * Content wrapper for chat messages
 * Provides proper spacing and layout for message content
 */
const ChatContainerContent = forwardRef<HTMLDivElement, ChatContainerContentProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <StickToBottom.Content
        className={cn(
          'flex flex-col gap-4',
          className
        )}
        {...props}
      >
        {children}
      </StickToBottom.Content>
    );
  }
);
ChatContainerContent.displayName = 'ChatContainerContent';

/**
 * Invisible scroll anchor for precise positioning
 * Ensures smooth scrolling behavior at the bottom of the chat
 */
const ChatContainerScrollAnchor = forwardRef<HTMLDivElement, ChatContainerScrollAnchorProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('min-h-1 shrink-0', className)}
        {...props}
      />
    );
  }
);
ChatContainerScrollAnchor.displayName = 'ChatContainerScrollAnchor';

/**
 * Enhanced chat container with additional features
 * Includes loading states, empty states, and error handling
 */
interface EnhancedChatContainerProps extends ChatContainerProps {
  isLoading?: boolean;
  isEmpty?: boolean;
  error?: string;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
}

const EnhancedChatContainer = forwardRef<HTMLDivElement, EnhancedChatContainerProps>(
  ({ 
    children, 
    className, 
    resize = 'smooth',
    isLoading = false,
    isEmpty = false,
    error,
    loadingComponent,
    emptyComponent,
    errorComponent,
    ...props 
  }, ref) => {
    // Error state
    if (error) {
      return (
        <div className={cn('flex items-center justify-center p-8', className)}>
          {errorComponent || (
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">Something went wrong</p>
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
      );
    }

    // Empty state
    if (isEmpty && !isLoading) {
      return (
        <div className={cn('flex items-center justify-center p-8', className)}>
          {emptyComponent || (
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm">Send a message to begin chatting</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <ChatContainerRoot
        ref={ref}
        className={className}
        resize={resize}
        {...props}
      >
        <ChatContainerContent>
          {children}
          {isLoading && (
            loadingComponent || (
              <div className="flex items-center justify-center p-4">
                <div className="text-sm text-muted-foreground">Loading...</div>
              </div>
            )
          )}
        </ChatContainerContent>
        <ChatContainerScrollAnchor />
      </ChatContainerRoot>
    );
  }
);
EnhancedChatContainer.displayName = 'EnhancedChatContainer';

/**
 * Hook for managing chat container scroll behavior
 * Provides utilities for programmatic scrolling and state management
 */
export function useChatContainer() {
  const scrollToBottom = (behavior: 'smooth' | 'instant' = 'smooth') => {
    // This would be implemented with the use-stick-to-bottom hook
    // For now, we'll use the component-based approach
  };

  const scrollToTop = (behavior: 'smooth' | 'instant' = 'smooth') => {
    const container = document.querySelector('[role="log"]');
    if (container) {
      container.scrollTo({
        top: 0,
        behavior: behavior === 'smooth' ? 'smooth' : 'auto'
      });
    }
  };

  return {
    scrollToBottom,
    scrollToTop,
  };
}

// Export components with compound component pattern
export const ChatContainer = Object.assign(ChatContainerRoot, {
  Root: ChatContainerRoot,
  Content: ChatContainerContent,
  ScrollAnchor: ChatContainerScrollAnchor,
  Enhanced: EnhancedChatContainer,
});

export {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
  EnhancedChatContainer,
};