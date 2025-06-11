'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon } from './icons';
import { useModelSelection } from '@/hooks/use-model-selection';
import type { ChatModel } from '@/lib/ai/models';

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  cohere: 'Cohere',
  groq: 'Groq',
};

export function ModelSelector({
  className,
}: {
  className?: string;
} & React.ComponentProps<typeof Button>) {
  const {
    selectedModel,
    selectModel,
    modelsByProvider,
    isLoading,
  } = useModelSelection();

  if (isLoading) {
    return (
      <Button
        variant="outline"
        className={cn('justify-between gap-2', className)}
        disabled
      >
        <span className="truncate">Loading models...</span>
        <div className="opacity-50">
          <ChevronDownIcon size={16} />
        </div>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-fit justify-between gap-2 text-sm font-medium',
            'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
            className,
          )}
        >
          <div className="flex items-center gap-2">
            <span className="truncate">
              {selectedModel ? (
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {providerLabels[selectedModel.provider]} •
                  </span>
                  <span>{selectedModel.name}</span>
                </span>
              ) : (
                'Select model'
              )}
            </span>
            <div className="opacity-50">
              <ChevronDownIcon size={16} />
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 max-h-[70vh] overflow-y-auto">
        {Object.entries(modelsByProvider).map(([provider, models]) => (
          <div key={provider}>
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
              {providerLabels[provider]}
            </DropdownMenuLabel>
            {(models as ChatModel[]).map((model) => (
              <DropdownMenuItem
                key={model.id}
                className={cn(
                  'flex cursor-pointer items-center justify-between',
                  'py-1.5 px-2 my-0.5 rounded-md',
                  'hover:bg-accent/50',
                  selectedModel?.id === model.id && 'bg-accent/80',
                )}
                onSelect={() => selectModel(model)}
              >
                <div className="flex-1">
                  <div className="font-medium">{model.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {model.description}
                  </div>
                </div>
                {selectedModel?.id === model.id && (
                  <div className="text-primary ml-2">
                    <CheckIcon size={16} />
                  </div>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="my-1" />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
