'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useModelSelection } from '@/hooks/use-model-selection';
import type { ChatModel } from '@/lib/ai/models';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon } from './icons';

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google',
};

export function ModelSelector({
  className,
}: {
  className?: string;
} & React.ComponentProps<typeof Button>) {
  const { selectedModel, selectModel, modelsByProvider, isLoading } =
    useModelSelection();

  if (isLoading) {
    return (
      <Button
        className={cn('justify-between gap-2', className)}
        disabled
        variant="outline"
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
          className={cn(
            'w-fit justify-between gap-2 font-medium text-sm',
            'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
            className,
          )}
          variant="outline"
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
      <DropdownMenuContent className="max-h-[70vh] w-80 overflow-y-auto">
        {Object.entries(modelsByProvider).map(([provider, models]) => (
          <div key={provider}>
            <DropdownMenuLabel className="px-2 py-1.5 font-semibold text-muted-foreground text-xs">
              {providerLabels[provider]}
            </DropdownMenuLabel>
            {(models as ChatModel[]).map((model) => (
              <DropdownMenuItem
                className={cn(
                  'flex cursor-pointer items-center justify-between',
                  'my-0.5 rounded-md px-2 py-1.5',
                  'hover:bg-accent/50',
                  selectedModel?.id === model.id && 'bg-accent/80',
                )}
                key={model.id}
                onSelect={() => selectModel(model)}
              >
                <div className="flex-1">
                  <div className="font-medium">{model.name}</div>
                  <div className="line-clamp-1 text-muted-foreground text-xs">
                    {model.description}
                  </div>
                </div>
                {selectedModel?.id === model.id && (
                  <div className="ml-2 text-primary">
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
