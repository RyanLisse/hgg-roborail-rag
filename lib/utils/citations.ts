import type { SourceAnnotation, SourceFile } from '@/lib/ai/responses';

// Re-export for convenience
export type { SourceFile };

export interface ParsedCitation {
  id: string;
  number: number;
  text: string;
  fileName: string;
  quote?: string;
  fileId: string;
}

export interface CitationContext {
  content: string;
  citations: ParsedCitation[];
  hasAnnotations: boolean;
}

// Performance optimization: Cache for parsed citations
const citationCache = new Map<string, CitationContext>();
const MAX_CACHE_SIZE = 1000;

// Performance optimization: Pre-compiled regex for citation markers
const CITATION_REGEX = /\[(\d+)\]/g;

/**
 * Generate cache key for citation parsing
 */
function generateCacheKey(
  content: string,
  annotations: SourceAnnotation[],
  sources: SourceFile[],
): string {
  return `${content.length}-${annotations.length}-${sources.length}-${annotations.map((a) => a.start_index).join(',')}`;
}

/**
 * Extract citation positions from content
 */
function extractCitationPositions(content: string): Map<number, number> {
  CITATION_REGEX.lastIndex = 0; // Reset regex state
  const citationMatches = Array.from(content.matchAll(CITATION_REGEX));
  const citationPositions = new Map<number, number>();

  citationMatches.forEach((match) => {
    if (match.index !== undefined) {
      const number = Number.parseInt(match[1], 10);
      citationPositions.set(number, match.index);
    }
  });

  return citationPositions;
}

/**
 * Find best matching citation number for annotation
 */
function findCitationNumber(
  annotation: SourceAnnotation,
  citationPositions: Map<number, number>,
  defaultNumber: number,
): number {
  for (const [number, position] of citationPositions) {
    if (Math.abs(position - annotation.start_index) <= 10) {
      return number;
    }
  }
  return defaultNumber;
}

/**
 * Cache parsed result with size management
 */
function cacheResult(cacheKey: string, result: CitationContext): void {
  if (citationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = citationCache.keys().next().value;
    if (firstKey) {
      citationCache.delete(firstKey);
    }
  }
  citationCache.set(cacheKey, result);
}

/**
 * Parse OpenAI response content and extract citations (optimized with caching)
 */
export function parseCitationsFromContent(
  content: string,
  annotations: SourceAnnotation[],
  sources: SourceFile[],
): CitationContext {
  // Performance optimization: Early return for empty inputs
  if (!(annotations.length && sources.length)) {
    return {
      content,
      citations: [],
      hasAnnotations: false,
    };
  }

  // Check cache first
  const cacheKey = generateCacheKey(content, annotations, sources);
  const cached = citationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Performance optimization: Use Map for O(1) lookups
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const citationPositions = extractCitationPositions(content);
  const citations: ParsedCitation[] = [];

  // Create citations from annotations
  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];
    if (annotation.type === 'file_citation' && annotation.file_citation) {
      const fileId = annotation.file_citation.file_id;
      const source = sourceMap.get(fileId);

      if (source) {
        const citationNumber = findCitationNumber(
          annotation,
          citationPositions,
          i + 1,
        );

        citations.push({
          id: `citation-${i}`,
          number: citationNumber,
          text: annotation.text,
          fileName: source.name,
          quote: annotation.file_citation.quote || undefined,
          fileId,
        });
      }
    }
  }

  // Sort citations by number
  citations.sort((a, b) => a.number - b.number);

  const result: CitationContext = {
    content,
    citations,
    hasAnnotations: true,
  };

  // Cache the result
  cacheResult(cacheKey, result);

  return result;
}

/**
 * Format citations for markdown display
 */
export function formatCitationsMarkdown(citations: ParsedCitation[]): string {
  if (!citations.length) {
    return '';
  }

  const formattedCitations = citations.map((citation) => {
    let formatted = `**[${citation.number}]** ${citation.fileName}`;

    if (citation.quote) {
      formatted += `\n> "${citation.quote}"`;
    }

    return formatted;
  });

  return `\n\n---\n\n**Sources:**\n\n${formattedCitations.join('\n\n')}`;
}

/**
 * Format citations for plain text display
 */
export function formatCitationsText(citations: ParsedCitation[]): string {
  if (!citations.length) {
    return '';
  }

  const formattedCitations = citations.map((citation) => {
    let formatted = `[${citation.number}] ${citation.fileName}`;

    if (citation.quote) {
      formatted += ` - "${citation.quote}"`;
    }

    return formatted;
  });

  return `\n\nSources:\n${formattedCitations.join('\n')}`;
}

/**
 * Extract unique source files from citations
 */
export function extractUniqueSourceFiles(
  citations: ParsedCitation[],
): SourceFile[] {
  const uniqueFiles = new Map<string, SourceFile>();

  citations.forEach((citation) => {
    if (!uniqueFiles.has(citation.fileId)) {
      uniqueFiles.set(citation.fileId, {
        id: citation.fileId,
        name: citation.fileName,
      });
    }
  });

  return Array.from(uniqueFiles.values());
}

/**
 * Replace citation markers in content with clickable links
 */
export function enhanceCitationsInContent(
  content: string,
  citations: ParsedCitation[],
): string {
  let enhancedContent = content;

  // Sort citations by number in descending order to avoid index shifts
  const sortedCitations = [...citations].sort((a, b) => b.number - a.number);

  sortedCitations.forEach((citation) => {
    const citationRegex = new RegExp(`\\[${citation.number}\\]`, 'g');
    enhancedContent = enhancedContent.replace(
      citationRegex,
      `[${citation.number}](#citation-${citation.id})`,
    );
  });

  return enhancedContent;
}

/**
 * Validate citation structure
 */
export function validateCitations(citations: ParsedCitation[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const numbers = new Set<number>();

  citations.forEach((citation, index) => {
    // Check for duplicate numbers
    if (numbers.has(citation.number)) {
      errors.push(`Duplicate citation number: ${citation.number}`);
    }
    numbers.add(citation.number);

    // Check for required fields
    if (!citation.fileName) {
      errors.push(`Citation ${index + 1} missing fileName`);
    }

    if (!citation.fileId) {
      errors.push(`Citation ${index + 1} missing fileId`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create citation footnotes for the end of content
 */
export function createCitationFootnotes(citations: ParsedCitation[]): string {
  if (!citations.length) {
    return '';
  }

  const footnotes = citations.map((citation) => {
    let footnote = `<div id="citation-${citation.id}" class="citation-footnote">
  <strong>[${citation.number}]</strong> ${citation.fileName}`;

    if (citation.quote) {
      footnote += `<br><em>"${citation.quote}"</em>`;
    }

    footnote += '</div>';
    return footnote;
  });

  return `\n\n<div class="citations-section">\n<h4>Sources</h4>\n${footnotes.join('\n')}\n</div>`;
}
