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

type VectorStoreType = 'openai' | 'supabase' | 'memory';

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
  supabase: 'Supabase Vector Store',
  memory: 'In-Memory Store',
};

const sourceDescriptions: Record<VectorStoreType, string> = {
  openai: 'OpenAI file search with vector store',
  supabase: 'Supabase vector store with pgvector',
  memory: 'Temporary in-memory vector storage',
};

const sourceColors: Record<VectorStoreType, string> = {
  openai: 'bg-green-100 text-green-800 border-green-200',
  supabase: 'bg-purple-100 text-purple-800 border-purple-200',
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

  const getSourceStatusIcon = (source: VectorStoreType, isEnabled: boolean) => {
    if (!isEnabled) {
      return <span className="text-muted-foreground text-xs">⚠️ Not configured</span>;
    }
    
    switch (source) {
      case 'supabase':
        return <span className="text-green-600 text-xs">🟢 Supabase</span>;
      case 'openai':
        return <span className="text-blue-600 text-xs">🔵 OpenAI</span>;
      case 'memory':
        return <span className="text-orange-600 text-xs">🟠 Memory</span>;
      default:
        return null;
    }
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
                onCheckedChange={() => {
                  if (isEnabled) {
                    handleSourceToggle(source);
                  }
                }}
                onSelect={(e) => e.preventDefault()}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{sourceLabels[source]}</span>
                    {getSourceStatusIcon(source, isEnabled)}
                  </div>
                  
                  {source === 'supabase' && (
                    <span className="text-muted-foreground text-xs">
                      PostgreSQL vector database with pgvector
                    </span>
                  )}
                  
                  {source === 'openai' && (
                    <span className="text-muted-foreground text-xs">
                      OpenAI's managed vector store service
                    </span>
                  )}
                  
                  {source === 'memory' && (
                    <span className="text-muted-foreground text-xs">
                      In-browser temporary storage
                    </span>
                  )}
                  
                  {stats?.count !== undefined && (
                    <span className="text-muted-foreground text-xs">
                      {stats.count} documents
                    </span>
                  )}
                  
                  {!isEnabled && (
                    <span className="text-red-500 text-xs">
                      {source === 'supabase' && 'Requires SUPABASE_URL and SUPABASE_ANON_KEY'}
                      {source === 'openai' && 'Requires OPENAI_API_KEY'}
                      {source === 'memory' && 'Always available'}
                    </span>
                  )}
                </div>
              </DropdownMenuCheckboxItem>
            );
          })}
          
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-muted-foreground text-xs">
            💡 Tip: You can select multiple sources for broader search coverage
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
    'supabase',
    'memory',
  ]);
  const [sourceStats, setSourceStats] = useState<
    Record<VectorStoreType, { enabled: boolean; count?: number }>
  >({
    openai: { enabled: true, count: 0 },
    supabase: { enabled: false, count: 0 },
    memory: { enabled: true },
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
          setAvailableSources(data.availableSources || ['openai', 'supabase', 'memory']);
          setSourceStats(
            data.sourceStats || {
              openai: { enabled: true, count: 0 },
              supabase: { enabled: false, count: 0 },
              memory: { enabled: true },
            },
          );

          // Prioritize enabled sources: OpenAI > Supabase > Memory
          let defaultSources: VectorStoreType[] = ['memory']; // Fallback
          
          if (data.sourceStats?.openai?.enabled) {
            defaultSources = ['openai'];
          } else if (data.sourceStats?.supabase?.enabled) {
            defaultSources = ['supabase'];
          }
          
          setSelectedSources(
            (prev) => {
              const filtered = prev.filter((source) =>
                data.availableSources?.includes(source),
              );
              return filtered.length > 0 ? filtered : defaultSources;
            },
          );
        }
      } catch (_error) {
        // On error, use fallback configuration with OpenAI as default
        setAvailableSources(['openai', 'memory']);
        setSourceStats({
          openai: { enabled: true, count: 0 },
          supabase: { enabled: false, count: 0 },
          memory: { enabled: true },
        });
        setSelectedSources(['openai']); // Default to OpenAI on error
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
        
        // Update available sources if they changed
        if (data.availableSources) {
          setAvailableSources(data.availableSources);
        }
      }
    } catch (_error) {
      // Handle error silently
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