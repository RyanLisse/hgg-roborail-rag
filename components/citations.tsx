'use client';

import { ChevronDown, ChevronUp, FileText, Quote } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { ParsedCitation, SourceFile } from '@/lib/utils/citations';

interface CitationsProps {
  citations: ParsedCitation[];
  sources?: SourceFile[];
  className?: string;
}

export function Citations({
  citations,
  sources,
  className = '',
}: CitationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Performance optimization: Memoize display citations calculation
  const displayCitations = useMemo(() => {
    if (citations.length > 0) {
      return citations;
    }
    return (
      sources?.map((source, index) => ({
        id: `source-${index}`,
        number: index + 1,
        text: '',
        fileName: source.name,
        fileId: source.id,
        quote: undefined,
      })) || []
    );
  }, [citations, sources]);

  // Performance optimization: Memoize toggle handler
  const handleToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  // Early return for empty citations
  if (displayCitations.length === 0) {
    return null;
  }

  return (
    <div className={`mt-4 border-t pt-4 ${className}`}>
      <button
        className="flex items-center gap-2 font-medium text-gray-700 text-sm transition-colors hover:text-gray-900"
        onClick={handleToggle}
        type="button"
      >
        <FileText className="size-4" />
        Sources ({displayCitations.length})
        {isExpanded ? (
          <ChevronUp className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {displayCitations.map((citation) => (
            <div
              className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
              id={`citation-${citation.id}`}
              key={citation.id}
            >
              <div className="shrink-0">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-800 text-xs">
                  {citation.number}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="truncate font-medium text-gray-900 text-sm">
                      {citation.fileName ||
                        (citation as unknown as SourceFile).name}
                    </p>

                    {citation.quote && (
                      <div className="mt-2 flex gap-2">
                        <Quote className="mt-0.5 size-3 shrink-0 text-gray-400" />
                        <p className="text-gray-600 text-xs italic">
                          &ldquo;{citation.quote}&rdquo;
                        </p>
                      </div>
                    )}

                    {citation.fileId && (
                      <p className="mt-1 font-mono text-gray-500 text-xs">
                        File ID: {citation.fileId}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface InlineCitationProps {
  number: number;
  citationId: string;
  className?: string;
}

export function InlineCitation({
  number,
  citationId,
  className = '',
}: InlineCitationProps) {
  // Performance optimization: Memoize click handler to prevent recreating on each render
  const handleClick = useCallback(() => {
    const element = document.getElementById(`citation-${citationId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add highlight effect
      element.classList.add('ring-2', 'ring-blue-300', 'ring-opacity-75');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-300', 'ring-opacity-75');
      }, 2000);
    }
  }, [citationId]);

  return (
    <button
      className={`inline-flex size-5 cursor-pointer items-center justify-center rounded-full bg-blue-100 font-medium text-blue-700 text-xs transition-colors hover:bg-blue-200 hover:text-blue-800 ${className}`}
      onClick={handleClick}
      title={`Jump to source ${number}`}
      type="button"
    >
      {number}
    </button>
  );
}

interface CitationBadgeProps {
  count: number;
  onClick?: () => void;
  className?: string;
}

export function CitationBadge({
  count,
  onClick,
  className = '',
}: CitationBadgeProps) {
  if (count === 0) {
    return null;
  }

  return (
    <button
      className={`inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 font-medium text-blue-700 text-xs transition-colors hover:bg-blue-200 ${className}`}
      onClick={onClick}
      type="button"
    >
      <FileText className="size-3" />
      {count} source{count !== 1 ? 's' : ''}
    </button>
  );
}
