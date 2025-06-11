'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useCallback } from 'react';
import { getDefaultModel, type ChatModel } from '@/lib/ai/models';

const MODEL_SELECTION_KEY = 'model-selection';

export function useModelSelection() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // Get the selected model
  const { data: selectedModel, isLoading } = useQuery<ChatModel>({
    queryKey: [MODEL_SELECTION_KEY, session?.user?.id],
    queryFn: async () => {
      if (typeof window === 'undefined') return getDefaultModel();
      
      const savedModelId = localStorage.getItem('selected-model-id');
      if (!savedModelId) return getDefaultModel();
      
      // We'll implement getModelById in the next step
      const model = (await import('@/lib/ai/models')).getModelById(savedModelId);
      return model || getDefaultModel();
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !!session?.user?.id,
  });

  // Mutation to update the selected model
  const { mutate: selectModel } = useMutation({
    mutationFn: async (model: ChatModel) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('selected-model-id', model.id);
      }
      return model;
    },
    onSuccess: (model) => {
      // Update the query data to avoid a refetch
      queryClient.setQueryData([MODEL_SELECTION_KEY, session?.user?.id], model);
    },
  });

  // Get available models for the current user
  const { data: availableModels = [] } = useQuery<ChatModel[]>({
    queryKey: ['available-models', session?.user?.type],
    queryFn: async () => {
      if (!session?.user?.type) return [];
      
      const { entitlementsByUserType } = await import('@/lib/ai/entitlements');
      const { chatModels } = await import('@/lib/ai/models');
      
      const { availableChatModelIds } = entitlementsByUserType[session.user.type];
      return chatModels.filter(model => availableChatModelIds.includes(model.id));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!session?.user?.type,
  });

  // Get models grouped by provider
  const modelsByProvider = useQuery({
    queryKey: ['models-by-provider', availableModels],
    queryFn: () => {
      if (!availableModels) return {};
      
      return availableModels.reduce<Record<string, ChatModel[]>>((acc, model) => {
        if (!acc[model.provider]) {
          acc[model.provider] = [];
        }
        acc[model.provider].push(model);
        return acc;
      }, {});
    },
    enabled: availableModels.length > 0,
  });

  return {
    selectedModel: selectedModel || getDefaultModel(),
    selectModel: useCallback((model: ChatModel) => selectModel(model), [selectModel]),
    availableModels,
    modelsByProvider: modelsByProvider.data || {},
    isLoading: isLoading || modelsByProvider.isLoading,
  };
}
