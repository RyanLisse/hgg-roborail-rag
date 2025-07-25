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

/**
 * Parse OpenAI response content and extract citations
 */
export function parseCitationsFromContent(
  content: string,
  annotations: SourceAnnotation[],
  sources: SourceFile[],
): CitationContext {
  if (!(annotations.length && sources.length)) {
    return {
      content,
      citations: [],
      hasAnnotations: false,
    };
  }

  const citations: ParsedCitation[] = [];
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const processedContent = content;

  // Extract citation markers from content (e.g., [1], [2], etc.)
  const citationRegex = /\[(\d+)\]/g;
  const citationMatches = Array.from(content.matchAll(citationRegex));

  // Create citations from annotations
  annotations.forEach((annotation, index) => {
    if (annotation.type === 'file_citation' && annotation.file_citation) {
      const fileId = annotation.file_citation.file_id;
      const source = sourceMap.get(fileId);

      if (source) {
        // Find corresponding citation number from content
        const citationNumber = citationMatches.find(
          (match) =>
            match.index &&
            match.index >= annotation.start_index - 10 &&
            match.index <= annotation.end_index + 10,
        );

        citations.push({
          id: `citation-${index}`,
          number: citationNumber
            ? Number.parseInt(citationNumber[1], 10)
            : index + 1,
          text: annotation.text,
          fileName: source.name,
          quote: annotation.file_citation.quote,
          fileId,
        });
      }
    }
  });

  // Sort citations by number
  citations.sort((a, b) => a.number - b.number);

  return {
    content: processedContent,
    citations,
    hasAnnotations: true,
  };
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
