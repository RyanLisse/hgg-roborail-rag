'use client';

import React, { useState } from 'react';
import type {
  AgentRouting,
  AgentMetadata,
} from '@/components/data-stream-handler';

// Simple global state management for agent info
const globalAgentInfo: {
  routing: AgentRouting | null;
  metadata: AgentMetadata | null;
} = {
  routing: null,
  metadata: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function useAgentInfo() {
  const [updateCount, setUpdateCount] = useState(0);

  // Subscribe to changes only once per component
  React.useEffect(() => {
    const listener = () => setUpdateCount((prev) => prev + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []); // Empty dependency array - only run once

  const setRouting = React.useCallback((routing: AgentRouting) => {
    if (globalAgentInfo.routing !== routing) {
      globalAgentInfo.routing = routing;
      notifyListeners();
    }
  }, []);

  const setMetadata = React.useCallback((metadata: AgentMetadata) => {
    if (globalAgentInfo.metadata !== metadata) {
      globalAgentInfo.metadata = metadata;
      notifyListeners();
    }
  }, []);

  const clear = React.useCallback(() => {
    if (globalAgentInfo.routing !== null || globalAgentInfo.metadata !== null) {
      globalAgentInfo.routing = null;
      globalAgentInfo.metadata = null;
      notifyListeners();
    }
  }, []);

  return {
    routing: globalAgentInfo.routing,
    metadata: globalAgentInfo.metadata,
    setRouting,
    setMetadata,
    clear,
  };
}
