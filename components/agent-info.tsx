'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { AgentRouting, AgentMetadata } from './data-stream-handler';
import { cn } from '@/lib/utils';

const agentLabels = {
  qa: 'Q&A Agent',
  rewrite: 'Rewrite Agent',
  planner: 'Planner Agent',
  research: 'Research Agent',
};

const agentColors = {
  qa: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  rewrite: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  planner:
    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  research:
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

const complexityColors = {
  simple: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  moderate:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  complex: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export function AgentInfo({
  routing,
  metadata,
  className,
}: {
  routing: AgentRouting | null;
  metadata?: AgentMetadata | null;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!routing) return null;

  const confidencePercentage = Math.round(routing.confidence * 100);

  return (
    <div className={cn('border rounded-lg p-3 bg-muted/30', className)}>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between p-0 h-auto"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Badge className={agentColors[routing.selectedAgent]}>
            {agentLabels[routing.selectedAgent]}
          </Badge>
          <Badge
            variant="outline"
            className={complexityColors[routing.estimatedComplexity]}
          >
            {routing.estimatedComplexity}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {confidencePercentage}% confidence
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </Button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              Routing Decision
            </h4>
            <p className="text-sm">{routing.reasoning}</p>
          </div>

          {metadata && (
            <>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Model: {metadata.modelUsed}</span>
                {metadata.responseTime && (
                  <span>{metadata.responseTime}ms</span>
                )}
                {metadata.confidence && (
                  <span>
                    Response confidence: {Math.round(metadata.confidence * 100)}
                    %
                  </span>
                )}
              </div>

              {metadata.sources && metadata.sources.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Sources ({metadata.sources.length})
                  </h4>
                  <div className="space-y-1">
                    {metadata.sources.slice(0, 3).map((source) => (
                      <div
                        key={source.id}
                        className="text-sm bg-background rounded p-2"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-muted-foreground truncate flex-1">
                            {source.content.slice(0, 100)}...
                          </span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {Math.round(source.score * 100)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {metadata.sources.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        and {metadata.sources.length - 3} more sources
                      </p>
                    )}
                  </div>
                </div>
              )}

              {metadata.citations && metadata.citations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Citations
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {metadata.citations.map((citation) => (
                      <Badge
                        key={citation}
                        variant="outline"
                        className="text-xs"
                      >
                        {citation}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
