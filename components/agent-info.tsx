"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgentMetadata, AgentRouting } from "./data-stream-handler";

const agentLabels = {
  qa: "Q&A Agent",
  rewrite: "Rewrite Agent",
  planner: "Planner Agent",
  research: "Research Agent",
};

const agentColors = {
  qa: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  rewrite: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  planner:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  research:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};

const complexityColors = {
  simple: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  moderate:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  complex: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
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
    <div className={cn("rounded-lg border bg-muted/30 p-3", className)}>
      <Button
        className="h-auto w-full justify-between p-0"
        onClick={() => setIsOpen(!isOpen)}
        size="sm"
        variant="ghost"
      >
        <div className="flex items-center gap-2">
          <Badge className={agentColors[routing.selectedAgent]}>
            {agentLabels[routing.selectedAgent]}
          </Badge>
          <Badge
            className={complexityColors[routing.estimatedComplexity]}
            variant="outline"
          >
            {routing.estimatedComplexity}
          </Badge>
          <span className="text-muted-foreground text-sm">
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
            <h4 className="mb-1 font-medium text-muted-foreground text-sm">
              Routing Decision
            </h4>
            <p className="text-sm">{routing.reasoning}</p>
          </div>

          {metadata && (
            <>
              <div className="flex items-center gap-4 text-muted-foreground text-sm">
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
                  <h4 className="mb-2 font-medium text-muted-foreground text-sm">
                    Sources ({metadata.sources.length})
                  </h4>
                  <div className="space-y-1">
                    {metadata.sources.slice(0, 3).map((source) => (
                      <div
                        className="rounded bg-background p-2 text-sm"
                        key={source.id}
                      >
                        <div className="flex items-start justify-between">
                          <span className="flex-1 truncate text-muted-foreground">
                            {source.content.slice(0, 100)}...
                          </span>
                          <Badge className="ml-2 text-xs" variant="outline">
                            {Math.round(source.score * 100)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {metadata.sources.length > 3 && (
                      <p className="text-muted-foreground text-xs">
                        and {metadata.sources.length - 3} more sources
                      </p>
                    )}
                  </div>
                </div>
              )}

              {metadata.citations && metadata.citations.length > 0 && (
                <div>
                  <h4 className="mb-1 font-medium text-muted-foreground text-sm">
                    Citations
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {metadata.citations.map((citation) => (
                      <Badge
                        className="text-xs"
                        key={citation}
                        variant="outline"
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
