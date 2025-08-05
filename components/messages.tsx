import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import equal from 'fast-deep-equal';
import { motion } from 'framer-motion';
import { memo } from 'react';
import { useMessages } from '@/hooks/use-messages';
import type { Vote } from '@/lib/db/schema';
import { ChatContainer } from './chat-container';
import { Greeting } from './greeting';
import { PreviewMessage, ThinkingMessage } from './message';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers['status'];
  votes: Vote[] | undefined;
  messages: UIMessage[];
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  } = useMessages({
    chatId,
    status,
  });

  return (
    <ChatContainer.Enhanced
      className="relative flex min-w-0 flex-1 flex-col"
      resize="smooth"
      isEmpty={messages.length === 0}
      isLoading={status === 'streaming'}
      emptyComponent={<Greeting />}
      ref={messagesContainerRef}
    >
      {messages.map((message, index) => (
        <PreviewMessage
          chatId={chatId}
          isLoading={status === 'streaming' && messages.length - 1 === index}
          isReadonly={isReadonly}
          key={message.id}
          message={message}
          reload={reload}
          requiresScrollPadding={
            hasSentMessage && index === messages.length - 1
          }
          setMessages={setMessages}
          vote={
            votes
              ? votes.find((vote) => vote.messageId === message.id)
              : undefined
          }
        />
      ))}

      {status === 'submitted' &&
        messages.length > 0 &&
        messages.at(-1)?.role === 'user' && <ThinkingMessage />}

      <motion.div
        className="min-h-[24px] min-w-[24px] shrink-0"
        onViewportEnter={onViewportEnter}
        onViewportLeave={onViewportLeave}
        ref={messagesEndRef}
      />
    </ChatContainer.Enhanced>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) {
    return true;
  }

  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.status && nextProps.status) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }
  if (!equal(prevProps.messages, nextProps.messages)) {
    return false;
  }
  if (!equal(prevProps.votes, nextProps.votes)) {
    return false;
  }

  return true;
});
