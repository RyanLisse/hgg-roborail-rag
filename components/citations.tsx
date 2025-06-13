'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Quote } from 'lucide-react';
import type { ParsedCitation, SourceFile } from '@/lib/utils/citations';

interface CitationsProps {
  citations: ParsedCitation[];
  sources?: SourceFile[];
  className?: string;
}

export function Citations({ citations, sources, className = '' }: CitationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!citations.length && !sources?.length) {
    return null;
  }

  const displayCitations = citations.length > 0 ? citations : 
    sources?.map((source, index) => ({
      id: `source-${index}`,
      number: index + 1,
      text: '',
      fileName: source.name,
      fileId: source.id,
      quote: undefined,
    })) || [];

  return (
    <div className={`border-t pt-4 mt-4 ${className}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
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
              key={citation.id}
              id={`citation-${citation.id}`}
              className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="shrink-0">
                <span className="inline-flex items-center justify-center size-6 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                  {citation.number}
                </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {citation.fileName || (citation as any).name}
                    </p>
                    
                    {citation.quote && (
                      <div className="mt-2 flex gap-2">
                        <Quote className="size-3 text-gray-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-600 italic">
                          &ldquo;{citation.quote}&rdquo;
                        </p>
                      </div>
                    )}
                    
                    {citation.fileId && (
                      <p className="text-xs text-gray-500 mt-1 font-mono">
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

export function InlineCitation({ number, citationId, className = '' }: InlineCitationProps) {
  const handleClick = () => {
    const element = document.getElementById(`citation-${citationId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add highlight effect
      element.classList.add('ring-2', 'ring-blue-300', 'ring-opacity-75');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-300', 'ring-opacity-75');
      }, 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center size-5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200 hover:text-blue-800 transition-colors cursor-pointer ${className}`}
      title={`Jump to source ${number}`}
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

export function CitationBadge({ count, onClick, className = '' }: CitationBadgeProps) {
  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors ${className}`}
    >
      <FileText className="size-3" />
      {count} source{count !== 1 ? 's' : ''}
    </button>
  );
}