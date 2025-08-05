'use client';

import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import equal from 'fast-deep-equal';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState, useEffect } from 'react';
import { AnimatedLogo } from './animated-logo';
import { StreamingText } from './streaming-text';
import type { Vote } from '@/lib/db/schema';
import { cn, sanitizeText } from '@/lib/utils';
import { Citations } from './citations';
import { DocumentToolCall, DocumentToolResult } from './document';
import { DocumentPreview } from './document-preview';
import { PencilEditIcon, SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { MessageEditor } from './message-editor';
import { MessageReasoning } from './message-reasoning';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Weather } from './weather';

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  requiresScrollPadding,
}: {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const messageVariants = {
    initial: { 
      y: 20, 
      opacity: 0, 
      scale: 0.95 
    },
    animate: { 
      y: 0, 
      opacity: 1, 
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 500,
        damping: 30,
        mass: 1,
        duration: 0.4
      }
    },
    exit: { 
      y: -20, 
      opacity: 0, 
      scale: 0.95,
      transition: { 
        duration: 0.2,
        ease: 'easeIn'
      }
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        variants={messageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        layout
        className="group/message mx-auto w-full max-w-3xl px-4"
        data-role={message.role}
        data-testid={`message-${message.role}`}
      >
        <div
          className={cn(
            'flex w-full gap-4 group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >
          {message.role === 'assistant' && (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
              <div className="translate-y-px">
                <SparklesIcon size={14} />
              </div>
            </div>
          )}

          <div
            className={cn('flex w-full flex-col gap-4', {
              'min-h-96': message.role === 'assistant' && requiresScrollPadding,
            })}
          >
            {message.experimental_attachments &&
              message.experimental_attachments.length > 0 && (
                <div
                  className="flex flex-row justify-end gap-2"
                  data-testid={`message-attachments`}
                >
                  {message.experimental_attachments.map((attachment) => (
                    <PreviewAttachment
                      attachment={attachment}
                      key={attachment.url}
                    />
                  ))}
                </div>
              )}

            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'reasoning') {
                return (
                  <MessageReasoning
                    isLoading={isLoading}
                    key={key}
                    reasoning={part.reasoning}
                  />
                );
              }

              if (type === 'text') {
                if (mode === 'view') {
                  return (
                    <div className="flex flex-row items-start gap-2" key={key}>
                      {message.role === 'user' && !isReadonly && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              className="h-fit rounded-full px-2 text-muted-foreground opacity-0 group-hover/message:opacity-100"
                              data-testid="message-edit-button"
                              onClick={() => {
                                setMode('edit');
                              }}
                              variant="ghost"
                            >
                              <PencilEditIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit message</TooltipContent>
                        </Tooltip>
                      )}

                      <div
                        className={cn('flex flex-col gap-4', {
                          'rounded-xl bg-primary px-3 py-2 text-primary-foreground':
                            message.role === 'user',
                        })}
                        data-testid="message-content"
                      >
                        {message.role === 'assistant' ? (
                          <StreamingText
                            content={part.text}
                            isLoading={isLoading}
                            enableStreaming={true}
                            enableMarkdown={true}
                            streamingSpeed={6}
                          />
                        ) : (
                          <Markdown>{sanitizeText(part.text)}</Markdown>
                        )}
                      </div>
                    </div>
                  );
                }

                if (mode === 'edit') {
                  return (
                    <div className="flex flex-row items-start gap-2" key={key}>
                      <div className="size-8" />

                      <MessageEditor
                        key={message.id}
                        message={message}
                        reload={reload}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  );
                }
              }

              if (type === 'tool-invocation') {
                const { toolInvocation } = part;
                const { toolName, toolCallId, state } = toolInvocation;

                if (state === 'call') {
                  const { args } = toolInvocation;

                  return (
                    <div
                      className={cn({
                        skeleton: ['getWeather'].includes(toolName),
                      })}
                      key={toolCallId}
                    >
                      {toolName === 'getWeather' ? (
                        <Weather />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview args={args} isReadonly={isReadonly} />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolCall
                          args={args}
                          isReadonly={isReadonly}
                          type="update"
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolCall
                          args={args}
                          isReadonly={isReadonly}
                          type="request-suggestions"
                        />
                      ) : null}
                    </div>
                  );
                }

                if (state === 'result') {
                  const { result } = toolInvocation;

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getWeather' ? (
                        <Weather weatherAtLocation={result} />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview
                          isReadonly={isReadonly}
                          result={result}
                        />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolResult
                          isReadonly={isReadonly}
                          result={result}
                          type="update"
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolResult
                          isReadonly={isReadonly}
                          result={result}
                          type="request-suggestions"
                        />
                      ) : toolName === 'enhancedSearch' ? (
                        <Citations
                          citations={result.citationSources || []}
                          sources={result.results || []}
                        />
                      ) : toolName === 'searchDocuments' ? (
                        <Citations
                          citations={result.results || []}
                          sources={result.results || []}
                        />
                      ) : (
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      )}
                    </div>
                  );
                }
              }
            })}

            {!isReadonly && (
              <MessageActions
                chatId={chatId}
                isLoading={isLoading}
                key={`action-${message.id}`}
                message={message}
                vote={vote}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.message.id !== nextProps.message.id) {
      return false;
    }
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding) {
      return false;
    }
    if (!equal(prevProps.message.parts, nextProps.message.parts)) {
      return false;
    }
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }

    return true;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';
  const [currentMessage, setCurrentMessage] = useState('Thinking...');
  const [messageIndex, setMessageIndex] = useState(0);

  // Progressive loading messages inspired by ContentPort
  const loadingMessages = [
    'Thinking...',
    'Analyzing your request...',
    'Processing with o4-mini reasoning...',
    'Generating response...'
  ];

  useEffect(() => {
    const intervals = [1000, 2500, 4000]; // Timing for each message transition
    let timeouts: NodeJS.Timeout[] = [];

    intervals.forEach((delay, index) => {
      const timeout = setTimeout(() => {
        if (index + 1 < loadingMessages.length) {
          setMessageIndex(index + 1);
          setCurrentMessage(loadingMessages[index + 1]);
        }
      }, delay);
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const containerVariants = {
    initial: { y: 10, opacity: 0 },
    animate: { 
      y: 0, 
      opacity: 1,
      transition: { 
        delay: 0.2,
        duration: 0.4,
        ease: 'easeOut'
      }
    },
    exit: { 
      y: -10, 
      opacity: 0,
      transition: { duration: 0.3 }
    }
  };

  const textVariants = {
    initial: { opacity: 0, y: 5 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3, ease: 'easeOut' }
    },
    exit: { 
      opacity: 0, 
      y: -5,
      transition: { duration: 0.2 }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="group/message mx-auto min-h-24 w-full max-w-3xl px-4"
      data-role={role}
      data-testid="message-assistant-loading"
    >
      <div
        className={cn(
          'flex w-full gap-4 rounded-xl group-data-[role=user]/message:ml-auto group-data-[role=user]/message:w-fit group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:px-3 group-data-[role=user]/message:py-2',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <AnimatedLogo 
            isAnimating={true} 
            size={14} 
            variant={messageIndex < 2 ? 'sparkles' : messageIndex < 3 ? 'pulse' : 'dots'}
          />
        </div>

        <div className="flex w-full flex-col gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMessage}
              variants={textVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex flex-col gap-4 text-muted-foreground"
            >
              {currentMessage}
              
              {/* Progress indicator */}
              <div className="flex gap-1 mt-1">
                {loadingMessages.map((_, index) => (
                  <motion.div
                    key={index}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full transition-colors duration-300',
                      index <= messageIndex ? 'bg-blue-500' : 'bg-muted'
                    )}
                    initial={{ scale: 0.6, opacity: 0.5 }}
                    animate={{ 
                      scale: index === messageIndex ? 1.2 : 1,
                      opacity: index <= messageIndex ? 1 : 0.3
                    }}
                    transition={{ duration: 0.3 }}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
