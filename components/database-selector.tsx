'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
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
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-between gap-2 text-sm font-medium',
              'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
            disabled={disabled}
          >
            <div className="flex items-center gap-2">
              <DatabaseIcon size={16} className="text-muted-foreground" />
              <span className="truncate">{getSelectedLabel()}</span>
            </div>
            <div className="opacity-50">
              <ChevronDownIcon size={16} />
            </div>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-80">
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
            Vector Store Sources
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {availableSources.map((source) => {
            const isSelected = selectedSources.includes(source);
            const stats = sourceStats?.[source];
            const isEnabled = stats?.enabled !== false;

            return (
              <DropdownMenuCheckboxItem
                key={source}
                checked={isSelected}
                onCheckedChange={() => handleSourceToggle(source)}
                disabled={!isEnabled}
                className={cn(
                  'flex cursor-pointer items-start justify-between',
                  'py-2 px-2 my-0.5 rounded-md',
                  'hover:bg-accent/50',
                  !isEnabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{sourceLabels[source]}</span>
                    {!isEnabled && (
                      <Badge variant="secondary" className="text-xs">
                        Disabled
                      </Badge>
                    )}
                    {isEnabled && stats?.count !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        {stats.count} docs
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sourceDescriptions[source]}
                  </div>
                </div>

                {isSelected && (
                  <div className="text-primary ml-2 mt-1">
                    <CheckIcon size={16} />
                  </div>
                )}
              </DropdownMenuCheckboxItem>
            );
          })}

          <DropdownMenuSeparator />

          <div className="px-2 py-1.5">
            <div className="text-xs text-muted-foreground">
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
              key={source}
              variant="outline"
              className={cn('text-xs', sourceColors[source])}
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
      } catch (error) {
        console.error('Failed to load available vector store sources:', error);
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
    } catch (error) {
      console.error('Failed to refresh vector store stats:', error);
    }
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
