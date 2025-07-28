'use client';
import { useRouter } from 'next/navigation';
import type { Session } from 'next-auth';
import { memo } from 'react';
import { useWindowSize } from 'usehooks-ts';
import { ModelSelector } from '@/components/model-selector';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { Button } from '@/components/ui/button';
import { DatabaseSelector } from './database-selector';
import { PlusIcon } from './icons';
import { useSidebar } from './ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type VectorStoreType = 'openai' | 'neon' | 'supabase' | 'memory';

function PureChatHeader({
  chatId: _chatId,
  selectedModelId: _selectedModelId,
  selectedSources,
  onSourcesChange,
  availableSources,
  sourceStats,
  isReadonly,
  session: _session,
}: {
  chatId: string;
  selectedModelId: string;
  selectedSources: VectorStoreType[];
  onSourcesChange: (sources: VectorStoreType[]) => void;
  availableSources: VectorStoreType[];
  sourceStats: Record<VectorStoreType, { enabled: boolean; count?: number }>;
  isReadonly: boolean;
  session: Session;
}) {
  const router = useRouter();
  const { open } = useSidebar();

  const { width: windowWidth } = useWindowSize();

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle />

      {(!open || windowWidth < 768) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="order-2 ml-auto px-2 md:order-1 md:ml-0 md:h-fit md:px-2"
              onClick={() => {
                router.push('/');
                router.refresh();
              }}
              variant="outline"
            >
              <PlusIcon />
              <span className="md:sr-only">New Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
      )}

      {!isReadonly && <ModelSelector className="order-2 md:order-2" />}

      {!isReadonly && (
        <DatabaseSelector
          availableSources={availableSources}
          className="order-3 flex md:order-3"
          data-testid="database-selector"
          onSourcesChange={onSourcesChange}
          selectedSources={selectedSources}
          sourceStats={sourceStats}
        />
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.selectedModelId === nextProps.selectedModelId &&
    JSON.stringify(prevProps.selectedSources) ===
      JSON.stringify(nextProps.selectedSources) &&
    JSON.stringify(prevProps.sourceStats) ===
      JSON.stringify(nextProps.sourceStats)
  );
});
