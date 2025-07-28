'use client';

import { useChat } from '@ai-sdk/react';
import type { Attachment, UIMessage } from 'ai';
import { useSearchParams } from 'next/navigation';
import type { Session } from 'next-auth';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { unstable_serialize } from 'swr/infinite';
import { ChatHeader } from '@/components/chat-header';
import {
  DatabaseSelector,
  useDatabaseSelection,
} from '@/components/database-selector';
import type { VisibilityType } from '@/components/visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import type { Vote } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType = 'private',
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: UIMessage[];
  initialChatModel: string;
  initialVisibilityType?: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
}) {
  const { mutate } = useSWRConfig();

  const searchParams = useSearchParams();
  const query = searchParams.get('query');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // Database selection for vector stores
  const {
    selectedSources,
    setSelectedSources,
    availableSources,
    sourceStats,
    isLoading: isLoadingSources,
  } = useDatabaseSelection();

  // Chat visibility management
  const { visibilityType, setVisibilityType: _setVisibilityType } =
    useChatVisibility({
      chatId: id,
      initialVisibilityType,
    });

  // Optimized useChat with memoized configuration
  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
    experimental_resume,
    data,
  } = useChat({
    id,
    initialMessages,
    experimental_throttle: 300, // Reduced frequency for better performance
    sendExtraMessageFields: true,
    generateId: generateUUID,
    fetch: fetchWithErrorHandlers,
    experimental_prepareRequestBody: (body) => ({
      id,
      message: body.messages.at(-1),
      selectedChatModel: initialChatModel,
      selectedVisibilityType: visibilityType,
      selectedSources,
    }),
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      }
    },
  });

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      append({
        role: 'user',
        content: query,
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, append, hasAppendedQuery, id]);

  useAutoResume({
    autoResume,
    initialMessages,
    experimental_resume,
    data,
    setMessages,
  });

  return (
    <>
      <div className="flex h-dvh min-w-0 flex-col bg-background">
        <ChatHeader
          availableSources={availableSources}
          chatId={id}
          isReadonly={isReadonly}
          onSourcesChange={setSelectedSources}
          selectedModelId={initialChatModel}
          selectedSources={selectedSources}
          session={session}
          sourceStats={sourceStats}
        />

        <Messages
          chatId={id}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          messages={messages}
          reload={reload}
          setMessages={setMessages}
          status={status}
          votes={votes}
        />

        <form className="mx-auto flex w-full flex-col gap-2 bg-background px-4 pb-4 md:max-w-3xl md:pb-6">
          {!isReadonly && (
            <div className="flex flex-col gap-2">
              {/* Database Selector for Vector Stores - Mobile only */}
              <div className="flex items-center gap-2 px-2 md:hidden">
                <span className="min-w-fit text-muted-foreground text-sm">
                  Data Sources:
                </span>
                <DatabaseSelector
                  availableSources={availableSources}
                  className="flex-1"
                  disabled={isLoadingSources}
                  onSourcesChange={setSelectedSources}
                  selectedSources={selectedSources}
                  sourceStats={sourceStats}
                />
              </div>

              <MultimodalInput
                append={append}
                attachments={attachments}
                chatId={id}
                handleSubmit={handleSubmit}
                input={input}
                messages={messages}
                setAttachments={setAttachments}
                setInput={setInput}
                setMessages={setMessages}
                status={status}
                stop={stop}
              />
            </div>
          )}
        </form>
      </div>

      <Artifact
        append={append}
        attachments={attachments}
        chatId={id}
        handleSubmit={handleSubmit}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        reload={reload}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />
    </>
  );
}
