'use client';

import React, { useState } from 'react';
import type { AgentRouting, AgentMetadata } from '@/components/data-stream-handler';

// Simple global state management for agent info
let globalAgentInfo: {
  routing: AgentRouting | null;
  metadata: AgentMetadata | null;
} = {
  routing: null,
  metadata: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(listener => listener());
}

export function useAgentInfo() {
  const [, forceUpdate] = useState({});

  const rerender = () => forceUpdate({});

  // Subscribe to changes
  React.useEffect(() => {
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, [rerender]);

  const setRouting = (routing: AgentRouting) => {
    globalAgentInfo.routing = routing;
    notifyListeners();
  };

  const setMetadata = (metadata: AgentMetadata) => {
    globalAgentInfo.metadata = metadata;
    notifyListeners();
  };

  const clear = () => {
    globalAgentInfo.routing = null;
    globalAgentInfo.metadata = null;
    notifyListeners();
  };

  return {
    routing: globalAgentInfo.routing,
    metadata: globalAgentInfo.metadata,
    setRouting,
    setMetadata,
    clear,
  };
}