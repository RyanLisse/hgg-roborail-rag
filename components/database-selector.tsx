'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon, DatabaseIcon } from './icons';

type VectorStoreType = 'openai' | 'neon' | 'memory';

interface DatabaseSelectorProps {
  selectedSources: VectorStoreType[];
  onSourcesChange: (sources: VectorStoreType[]) => void;
  availableSources: VectorStoreType[];
  sourceStats?: Record<VectorStoreType, { enabled: boolean; count?: number }>;
  className?: string;
  disabled?: boolean;
}

const sourceLabels: Record<VectorStoreType, string> = {
  openai: 'OpenAI Vector Store',
  neon: 'NeonDB (pgvector)',
  memory: 'In-Memory Store',
};

const sourceDescriptions: Record<VectorStoreType, string> = {
  openai: 'OpenAI file search with vector store',
  neon: 'PostgreSQL with pgvector extension',
  memory: 'Temporary in-memory vector storage',
};

const sourceColors: Record<VectorStoreType, string> = {
  openai: 'bg-green-100 text-green-800 border-green-200',
  neon: 'bg-blue-100 text-blue-800 border-blue-200',
  memory: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function DatabaseSelector({
  selectedSources,
  onSourcesChange,
  availableSources,
  sourceStats,
  className,
  disabled = false,
}: DatabaseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSourceToggle = (source: VectorStoreType) => {
    if (selectedSources.includes(source)) {
      // Remove source if already selected
      onSourcesChange(selectedSources.filter((s) => s !== source));
    } else {
      // Add source if not selected
      onSourcesChange([...selectedSources, source]);
    }
  };

  const getSelectedLabel = () => {
    if (selectedSources.length === 0) {
      return 'No sources selected';
    }

    if (selectedSources.length === 1) {
      return sourceLabels[selectedSources[0]];
    }

    if (selectedSources.length === availableSources.length) {
      return 'All sources';
    }

    return `${selectedSources.length} sources`;
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            className={cn(
              'w-full justify-between gap-2 font-medium text-sm',
              'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
              disabled && 'cursor-not-allowed opacity-50',
            )}
            disabled={disabled}
            variant="outline"
          >
            <div className="flex items-center gap-2">
              <DatabaseIcon className="text-muted-foreground" size={16} />
              <span className="truncate">{getSelectedLabel()}</span>
            </div>
            <div className="opacity-50">
              <ChevronDownIcon size={16} />
            </div>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-80">
          <DropdownMenuLabel className="px-2 py-1.5 font-semibold text-muted-foreground text-xs">
            Vector Store Sources
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {availableSources.map((source) => {
            const isSelected = selectedSources.includes(source);
            const stats = sourceStats?.[source];
            const isEnabled = stats?.enabled !== false;

            return (
              <DropdownMenuCheckboxItem
                checked={isSelected}
                className={cn(
                  'flex cursor-pointer items-start justify-between',
                  'my-0.5 rounded-md px-2 py-2',
                  'hover:bg-accent/50',
                  !isEnabled && 'cursor-not-allowed opacity-50',
                )}
                disabled={!isEnabled}
                key={source}
                onCheckedChange={() => handleSourceToggle(source)}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{sourceLabels[source]}</span>
                    {!isEnabled && (
                      <Badge className="text-xs" variant="secondary">
                        Disabled
                      </Badge>
                    )}
                    {isEnabled && stats?.count !== undefined && (
                      <Badge className="text-xs" variant="outline">
                        {stats.count} docs
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {sourceDescriptions[source]}
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-1 ml-2 text-primary">
                    <CheckIcon size={16} />
                  </div>
                )}
              </DropdownMenuCheckboxItem>
            );
          })}

          <DropdownMenuSeparator />

          <div className="px-2 py-1.5">
            <div className="text-muted-foreground text-xs">
              Select multiple sources to search across all of them
              simultaneously.
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selected sources badges */}
      {selectedSources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedSources.map((source) => (
            <Badge
              className={cn('text-xs', sourceColors[source])}
              key={source}
              variant="outline"
            >
              {sourceLabels[source]}
              {sourceStats?.[source]?.count !== undefined && (
                <span className="ml-1 opacity-70">
                  ({sourceStats[source].count})
                </span>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Hook for managing database selection state
export function useDatabaseSelection() {
  const [selectedSources, setSelectedSources] = useState<VectorStoreType[]>([
    'openai',
  ]);
  const [availableSources, setAvailableSources] = useState<VectorStoreType[]>([
    'openai',
    'memory',
  ]);
  const [sourceStats, setSourceStats] = useState<
    Record<VectorStoreType, { enabled: boolean; count?: number }>
  >({
    openai: { enabled: true, count: 0 },
    memory: { enabled: true },
    neon: { enabled: false },
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAvailableSources = async () => {
      try {
        setIsLoading(true);

        // Load available sources from the unified service
        const response = await fetch('/api/vectorstore/sources');
        if (response.ok) {
          const data = await response.json();
          setAvailableSources(data.availableSources || ['openai', 'memory']);
          setSourceStats(
            data.sourceStats || {
              openai: { enabled: true, count: 0 },
              memory: { enabled: true },
              neon: { enabled: false },
            },
          );

          // Update selected sources to prioritize OpenAI, fallback to available ones
          const defaultSources = data.availableSources?.includes('openai')
            ? ['openai']
            : ['memory'];
          setSelectedSources(
            (prev) =>
              prev.filter((source) =>
                data.availableSources?.includes(source),
              ) || defaultSources,
          );
        }
      } catch (_error) {
      } finally {
        setIsLoading(false);
      }
    };

    loadAvailableSources();
  }, []);

  const refreshStats = async () => {
    try {
      const response = await fetch('/api/vectorstore/sources');
      if (response.ok) {
        const data = await response.json();
        setSourceStats(data.sourceStats || sourceStats);
      }
    } catch (_error) {}
  };

  return {
    selectedSources,
    setSelectedSources,
    availableSources,
    sourceStats,
    isLoading,
    refreshStats,
  };
}
