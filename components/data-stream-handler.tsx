'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';
import { artifactDefinitions, type ArtifactKind } from './artifact';
import type { Suggestion } from '@/lib/db/schema';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { useAgentInfo } from '@/hooks/use-agent-info';

export type AgentRouting = {
  selectedAgent: 'qa' | 'rewrite' | 'planner' | 'research';
  confidence: number;
  reasoning: string;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
};

export type AgentMetadata = {
  agent: 'qa' | 'rewrite' | 'planner' | 'research';
  modelUsed: string;
  sources?: Array<{
    id: string;
    content: string;
    score: number;
    metadata?: Record<string, any>;
  }>;
  citations?: string[];
  confidence?: number;
  responseTime?: number;
};

export type DataStreamDelta = {
  type:
    | 'text-delta'
    | 'code-delta'
    | 'sheet-delta'
    | 'image-delta'
    | 'title'
    | 'id'
    | 'suggestion'
    | 'clear'
    | 'finish'
    | 'kind'
    | 'agent-routing'
    | 'agent-metadata';
  content?: string | Suggestion;
  routing?: AgentRouting;
  metadata?: AgentMetadata;
};

export function DataStreamHandler({ id }: { id: string }) {
  const { data: dataStream } = useChat({ id });
  const { artifact, setArtifact, setMetadata } = useArtifact();
  const { setRouting, setMetadata: setAgentMetadata, clear } = useAgentInfo();
  const lastProcessedIndex = useRef(-1);

  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    (newDeltas as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
      const artifactDefinition = artifactDefinitions.find(
        (artifactDefinition) => artifactDefinition.kind === artifact.kind,
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      setArtifact((draftArtifact) => {
        if (!draftArtifact) {
          return { ...initialArtifactData, status: 'streaming' };
        }

        switch (delta.type) {
          case 'id':
            return {
              ...draftArtifact,
              documentId: delta.content as string,
              status: 'streaming',
            };

          case 'title':
            return {
              ...draftArtifact,
              title: delta.content as string,
              status: 'streaming',
            };

          case 'kind':
            return {
              ...draftArtifact,
              kind: delta.content as ArtifactKind,
              status: 'streaming',
            };

          case 'clear':
            return {
              ...draftArtifact,
              content: '',
              status: 'streaming',
            };

          case 'finish':
            return {
              ...draftArtifact,
              status: 'idle',
            };

          case 'agent-routing':
            if (delta.routing) {
              setRouting(delta.routing);
            }
            return draftArtifact;

          case 'agent-metadata':
            if (delta.metadata) {
              setAgentMetadata(delta.metadata);
            }
            return draftArtifact;

          default:
            return draftArtifact;
        }
      });
    });
  }, [
    dataStream,
    setArtifact,
    setMetadata,
    artifact,
    setRouting,
    setAgentMetadata,
  ]);

  // Clear agent info when starting a new conversation
  useEffect(() => {
    if (!dataStream?.length) {
      clear();
    }
  }, [dataStream?.length, clear]);

  return null;
}
