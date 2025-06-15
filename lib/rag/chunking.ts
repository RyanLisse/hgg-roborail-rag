import { z } from 'zod';

// Schemas for chunking configuration and results
export const ChunkMetadata = z
  .object({
    title: z.string().optional(),
    source: z.string().optional(),
    chunkIndex: z.number(),
    totalChunks: z.number(),
    chunkType: z
      .enum(['text', 'code', 'heading', 'paragraph', 'list', 'table'])
      .optional(),
    documentStructure: z
      .object({
        section: z.string().optional(),
        subsection: z.string().optional(),
        hierarchy: z.array(z.string()).optional(),
      })
      .optional(),
    quality: z
      .object({
        score: z.number().min(0).max(1),
        completeness: z.number().min(0).max(1),
        coherence: z.number().min(0).max(1),
      })
      .optional(),
    timestamp: z.date().optional(),
  })
  .passthrough();

export const ChunkingStrategy = z.enum([
  'character', // Basic character-based chunking
  'semantic', // Respect document structure boundaries
  'recursive', // Recursively break down large chunks
  'hybrid', // Combine multiple strategies
  'sentence', // Split on sentence boundaries
  'paragraph', // Split on paragraph boundaries
  'markdown', // Markdown-aware chunking
  'code', // Code-aware chunking
]);

export const ChunkingConfig = z.object({
  strategy: ChunkingStrategy.default('hybrid'),
  chunkSize: z.number().min(100).max(10000).default(1500),
  chunkOverlap: z.number().min(0).max(1000).default(200),
  preserveStructure: z.boolean().default(true),
  respectBoundaries: z.boolean().default(true),
  minChunkSize: z.number().min(10).default(100),
  maxChunkSize: z.number().min(500).default(3000),
  enableQualityValidation: z.boolean().default(true),
  customSeparators: z.array(z.string()).optional(),
  codeLanguage: z.string().optional(),
});

export const DocumentChunk = z.object({
  id: z.string(),
  documentId: z.string(),
  content: z.string(),
  metadata: ChunkMetadata,
  boundaries: z.object({
    start: z.number(),
    end: z.number(),
    preservedStructure: z.boolean(),
  }),
});

// Types
export type ChunkMetadata = z.infer<typeof ChunkMetadata>;
export type ChunkingStrategy = z.infer<typeof ChunkingStrategy>;
export type ChunkingConfig = z.infer<typeof ChunkingConfig>;
export type DocumentChunk = z.infer<typeof DocumentChunk>;

export interface Document {
  id: string;
  content: string;
  type?: 'text' | 'markdown' | 'code' | 'html';
  metadata: Record<string, unknown>;
}

export interface ChunkingResult {
  chunks: DocumentChunk[];
  strategy: ChunkingStrategy;
  totalTokens: number;
  avgChunkSize: number;
  qualityMetrics: {
    avgQualityScore: number;
    structurePreservation: number;
    boundaryCoverage: number;
  };
}

// Structure detection patterns
const MARKDOWN_PATTERNS = {
  heading: /^#{1,6}\s+(.+)$/gm,
  codeBlock: /```[\s\S]*?```/g,
  paragraph: /\n\s*\n/g,
  list: /^[\s]*[-*+]\s+/gm,
  table: /\|.*\|/g,
};

const CODE_PATTERNS = {
  function: /(?:function|def|class|interface|type)\s+\w+/g,
  comment: /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
  block: /\{[\s\S]*?\}/g,
};

const STRUCTURE_SEPARATORS = [
  '\n\n\n', // Major section breaks
  '\n\n', // Paragraph breaks
  '\n---\n', // Horizontal rules
  '\n***\n', // Alternative horizontal rules
  '\n===\n', // Title underlines
  '\n---', // Section breaks
];

// Quality validation functions
function validateChunkQuality(
  chunk: string,
  context: {
    documentType?: string;
    preservedStructure: boolean;
    chunkIndex: number;
    totalChunks: number;
  },
): { score: number; completeness: number; coherence: number } {
  let score = 0.5; // Base score
  let completeness = 0.5;
  let coherence = 0.5;

  // Check for complete sentences
  const sentences = chunk.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length > 0) {
    const lastSentence = sentences[sentences.length - 1].trim();
    if (
      lastSentence.match(/[.!?]$/) ||
      context.chunkIndex === context.totalChunks - 1
    ) {
      completeness += 0.3;
    }
  }

  // Check for structural integrity
  if (context.preservedStructure) {
    score += 0.2;
    coherence += 0.2;
  }

  // Check for meaningful content (not just whitespace/formatting)
  const meaningfulContent = chunk.replace(/\s+/g, ' ').trim();
  if (meaningfulContent.length > 20) {
    score += 0.2;
    coherence += 0.2;
  }

  // Check for balanced parentheses/brackets in code
  if (context.documentType === 'code') {
    const openBrackets = (chunk.match(/[{[(]/g) || []).length;
    const closeBrackets = (chunk.match(/[}\])]/g) || []).length;
    if (Math.abs(openBrackets - closeBrackets) <= 1) {
      coherence += 0.2;
    }
  }

  // Penalize extremely short or long chunks
  const idealLength = 1500;
  const lengthRatio = Math.min(chunk.length, idealLength) / idealLength;
  score = Math.min(1, score + lengthRatio * 0.1);

  return {
    score: Math.min(1, Math.max(0, score)),
    completeness: Math.min(1, Math.max(0, completeness)),
    coherence: Math.min(1, Math.max(0, coherence)),
  };
}

// Document structure analysis
function analyzeDocumentStructure(
  content: string,
  documentType?: string,
): {
  headings: Array<{ level: number; text: string; position: number }>;
  codeBlocks: Array<{ language?: string; position: number; length: number }>;
  paragraphs: Array<{ position: number; length: number }>;
  lists: Array<{ position: number; length: number }>;
  naturalBreaks: number[];
} {
  const headings: Array<{ level: number; text: string; position: number }> = [];
  const codeBlocks: Array<{
    language?: string;
    position: number;
    length: number;
  }> = [];
  const paragraphs: Array<{ position: number; length: number }> = [];
  const lists: Array<{ position: number; length: number }> = [];
  const naturalBreaks: number[] = [];

  if (documentType === 'markdown') {
    // Extract headings
    let match: RegExpExecArray | null = MARKDOWN_PATTERNS.heading.exec(content);
    while (match !== null) {
      const level = match[0].indexOf(' ') - 1; // Count # characters
      headings.push({
        level,
        text: match[1],
        position: match.index,
      });
      match = MARKDOWN_PATTERNS.heading.exec(content);
    }

    // Extract code blocks
    match = MARKDOWN_PATTERNS.codeBlock.exec(content);
    while (match !== null) {
      const langMatch = match[0].match(/```(\w+)?/);
      codeBlocks.push({
        language: langMatch?.[1],
        position: match.index,
        length: match[0].length,
      });
      match = MARKDOWN_PATTERNS.codeBlock.exec(content);
    }

    // Extract lists
    match = MARKDOWN_PATTERNS.list.exec(content);
    while (match !== null) {
      lists.push({
        position: match.index,
        length: match[0].length,
      });
      match = MARKDOWN_PATTERNS.list.exec(content);
    }
  }

  // Find paragraph breaks
  const paragraphRegex = /\n\s*\n/g;
  let paragraphMatch: RegExpExecArray | null = paragraphRegex.exec(content);
  while (paragraphMatch !== null) {
    naturalBreaks.push(paragraphMatch.index);
    paragraphs.push({
      position: paragraphMatch.index,
      length: 2,
    });
    paragraphMatch = paragraphRegex.exec(content);
  }

  // Find sentence boundaries
  const sentenceRegex = /[.!?]+\s+/g;
  let sentenceMatch: RegExpExecArray | null = sentenceRegex.exec(content);
  while (sentenceMatch !== null) {
    naturalBreaks.push(sentenceMatch.index + sentenceMatch[0].length);
    sentenceMatch = sentenceRegex.exec(content);
  }

  // Remove duplicates and sort
  const uniqueBreaks = Array.from(new Set(naturalBreaks)).sort((a, b) => a - b);

  return {
    headings,
    codeBlocks,
    paragraphs,
    lists,
    naturalBreaks: uniqueBreaks,
  };
}

// Core chunking strategies
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern for organized functionality
class CharacterChunker {
  static chunk(content: string, config: ChunkingConfig): string[] {
    const { chunkSize, chunkOverlap } = config;
    const chunks: string[] = [];

    if (content.length <= chunkSize) {
      return [content];
    }

    let start = 0;
    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      chunks.push(content.slice(start, end));

      // If we've reached the end, break
      if (end >= content.length) {
        break;
      }

      // Move to next chunk with overlap
      start = end - chunkOverlap;

      // Ensure we make progress to avoid infinite loops
      if (start >= end || chunkOverlap >= chunkSize) {
        start = end;
      }
    }

    return chunks.filter((chunk) => chunk.trim().length > 0);
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern for organized functionality
class SemanticChunker {
  static chunk(
    content: string,
    config: ChunkingConfig,
    documentType?: string,
  ): string[] {
    const structure = analyzeDocumentStructure(content, documentType);
    const chunks: string[] = [];
    const { chunkSize, chunkOverlap, minChunkSize, maxChunkSize } = config;

    // Prioritize structure-aware breaks
    const breakPoints = [
      ...structure.headings.map((h) => h.position),
      ...structure.naturalBreaks,
    ].sort((a, b) => a - b);

    let start = 0;
    for (const breakPoint of breakPoints) {
      if (breakPoint - start >= minChunkSize) {
        let chunkEnd = breakPoint;

        // Extend chunk if it's too small
        while (chunkEnd - start < chunkSize && chunkEnd < content.length) {
          const nextBreak = breakPoints.find((bp) => bp > chunkEnd);
          if (nextBreak && nextBreak - start <= maxChunkSize) {
            chunkEnd = nextBreak;
          } else {
            break;
          }
        }

        const chunk = content.slice(start, chunkEnd).trim();
        if (chunk.length >= minChunkSize) {
          chunks.push(chunk);
          start = Math.max(chunkEnd - chunkOverlap, start + minChunkSize);
        }
      }
    }

    // Handle remaining content
    if (start < content.length) {
      const remaining = content.slice(start).trim();
      if (remaining.length >= minChunkSize) {
        chunks.push(remaining);
      } else if (chunks.length > 0) {
        // Merge with last chunk if too small
        chunks[chunks.length - 1] += `\n${remaining}`;
      } else {
        chunks.push(remaining);
      }
    }

    return chunks.filter((chunk) => chunk.length > 0);
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern for organized functionality
class RecursiveChunker {
  static chunk(
    content: string,
    config: ChunkingConfig,
    documentType?: string,
  ): string[] {
    const { chunkSize, minChunkSize, maxChunkSize } = config;
    const separators = config.customSeparators || STRUCTURE_SEPARATORS;

    return RecursiveChunker.recursiveChunk(
      content,
      separators,
      config,
      documentType,
    );
  }

  private static recursiveChunk(
    content: string,
    separators: string[],
    config: ChunkingConfig,
    documentType?: string,
    depth = 0,
  ): string[] {
    const { chunkSize, minChunkSize, maxChunkSize } = config;

    // Base case: content is small enough
    if (content.length <= chunkSize || depth > 5) {
      return content.trim().length >= minChunkSize ? [content.trim()] : [];
    }

    // Try to split on the most appropriate separator
    for (const separator of separators) {
      const splits = content.split(separator);
      if (splits.length > 1) {
        const chunks: string[] = [];
        let currentChunk = '';

        for (let i = 0; i < splits.length; i++) {
          const split = splits[i];
          const testChunk =
            currentChunk + (currentChunk ? separator : '') + split;

          if (testChunk.length <= chunkSize) {
            currentChunk = testChunk;
          } else {
            // Current chunk is full, process it
            if (currentChunk.trim().length >= minChunkSize) {
              if (currentChunk.length > maxChunkSize) {
                // Recursively chunk if still too large
                chunks.push(
                  ...RecursiveChunker.recursiveChunk(
                    currentChunk,
                    separators.slice(1),
                    config,
                    documentType,
                    depth + 1,
                  ),
                );
              } else {
                chunks.push(currentChunk.trim());
              }
            }

            // Start new chunk with current split
            currentChunk = split;
          }
        }

        // Add final chunk
        if (currentChunk.trim().length >= minChunkSize) {
          if (currentChunk.length > maxChunkSize) {
            chunks.push(
              ...RecursiveChunker.recursiveChunk(
                currentChunk,
                separators.slice(1),
                config,
                documentType,
                depth + 1,
              ),
            );
          } else {
            chunks.push(currentChunk.trim());
          }
        } else if (currentChunk.trim().length > 0 && chunks.length === 0) {
          // If it's the only chunk and has content, include it anyway
          chunks.push(currentChunk.trim());
        }

        // Only return if we actually created multiple chunks or successfully chunked
        if (chunks.length > 0) {
          return chunks.filter((chunk) => chunk.length > 0);
        }
      }
    }

    // Fallback to character chunking if no separators work
    return CharacterChunker.chunk(content, config);
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern for organized functionality
class HybridChunker {
  static chunk(
    content: string,
    config: ChunkingConfig,
    documentType?: string,
  ): string[] {
    // First, try semantic chunking
    const chunks = SemanticChunker.chunk(content, config, documentType);

    // If chunks are too large, apply recursive chunking
    const processedChunks: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length > config.maxChunkSize) {
        const subChunks = RecursiveChunker.chunk(chunk, config, documentType);
        processedChunks.push(...subChunks);
      } else {
        processedChunks.push(chunk);
      }
    }

    // Final quality check and adjustment
    return HybridChunker.optimizeChunks(processedChunks, config);
  }

  private static optimizeChunks(
    chunks: string[],
    config: ChunkingConfig,
  ): string[] {
    const optimized: string[] = [];
    const { minChunkSize, chunkSize } = config;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Merge small chunks with next chunk if possible
      if (chunk.length < minChunkSize && i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        if (chunk.length + nextChunk.length <= chunkSize * 1.2) {
          chunks[i + 1] = `${chunk}\n\n${nextChunk}`;
          continue;
        }
      }

      optimized.push(chunk);
    }

    const filtered = optimized.filter(
      (chunk) => chunk.trim().length >= minChunkSize,
    );

    // If no chunks meet minimum size but we have content, include at least one chunk
    if (filtered.length === 0 && optimized.length > 0) {
      return [optimized[0]];
    }

    return filtered;
  }
}

// Main chunking service
export class DocumentChunkingService {
  private config: ChunkingConfig;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = ChunkingConfig.parse(config);
  }

  async chunkDocument(document: Document): Promise<ChunkingResult> {
    const validatedConfig = ChunkingConfig.parse(this.config);
    const { strategy, enableQualityValidation } = validatedConfig;

    let chunks: string[];

    // Handle empty or very short content
    if (!document.content || document.content.trim().length === 0) {
      return {
        chunks: [],
        strategy,
        totalTokens: 0,
        avgChunkSize: 0,
        qualityMetrics: {
          avgQualityScore: 0,
          structurePreservation: 0,
          boundaryCoverage: 0,
        },
      };
    }

    // Apply appropriate chunking strategy
    switch (strategy) {
      case 'character':
        chunks = CharacterChunker.chunk(document.content, validatedConfig);
        break;
      case 'semantic':
        chunks = SemanticChunker.chunk(
          document.content,
          validatedConfig,
          document.type,
        );
        break;
      case 'recursive':
        chunks = RecursiveChunker.chunk(
          document.content,
          validatedConfig,
          document.type,
        );
        break;
      case 'hybrid':
        chunks = HybridChunker.chunk(
          document.content,
          validatedConfig,
          document.type,
        );
        break;
      case 'sentence':
        chunks = this.chunkBySentences(document.content, validatedConfig);
        break;
      case 'paragraph':
        chunks = this.chunkByParagraphs(document.content, validatedConfig);
        break;
      case 'markdown':
        chunks = this.chunkMarkdown(document.content, validatedConfig);
        break;
      case 'code':
        chunks = this.chunkCode(document.content, validatedConfig);
        break;
      default:
        chunks = HybridChunker.chunk(
          document.content,
          validatedConfig,
          document.type,
        );
    }

    // Ensure we have at least one chunk for non-empty content
    if (chunks.length === 0 && document.content.trim().length > 0) {
      chunks = [document.content.trim()];
    }

    // Create document chunks with metadata
    let lastEnd = 0;
    const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => {
      // Find the actual position of this chunk in the original content
      let start = document.content.indexOf(chunk, lastEnd);
      if (start === -1) {
        // If exact match not found, try to find a close match
        start = lastEnd;
      }
      const end = start + chunk.length;
      lastEnd = end;

      const preservedStructure = strategy !== 'character';

      const quality = enableQualityValidation
        ? validateChunkQuality(chunk, {
            documentType: document.type,
            preservedStructure,
            chunkIndex: index,
            totalChunks: chunks.length,
          })
        : { score: 0.8, completeness: 0.8, coherence: 0.8 };

      const metadata: ChunkMetadata = {
        ...document.metadata,
        chunkIndex: index,
        totalChunks: chunks.length,
        chunkType: this.detectChunkType(chunk, document.type),
        quality,
        timestamp: new Date(),
      };

      return {
        id: `${document.id}-chunk-${index}`,
        documentId: document.id,
        content: chunk,
        metadata,
        boundaries: {
          start,
          end,
          preservedStructure,
        },
      };
    });

    // Calculate quality metrics
    const qualityScores = documentChunks.map(
      (chunk) => chunk.metadata.quality?.score || 0,
    );
    const avgQualityScore =
      qualityScores.reduce((sum, score) => sum + score, 0) /
      qualityScores.length;
    const structurePreservation =
      documentChunks.filter((chunk) => chunk.boundaries.preservedStructure)
        .length / documentChunks.length;

    const result: ChunkingResult = {
      chunks: documentChunks,
      strategy,
      totalTokens: this.estimateTokens(document.content),
      avgChunkSize:
        chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length,
      qualityMetrics: {
        avgQualityScore,
        structurePreservation,
        boundaryCoverage: this.calculateBoundaryCoverage(
          documentChunks,
          document.content,
        ),
      },
    };

    return result;
  }

  private chunkBySentences(content: string, config: ChunkingConfig): string[] {
    const sentences = content
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0);

    // Special handling for sentence strategy: ensure we create multiple chunks
    // when we have multiple sentences, even if they fit in one chunk
    if (sentences.length > 1) {
      // For sentence chunking, aim to distribute sentences evenly
      const targetChunks = Math.min(
        sentences.length,
        Math.max(2, Math.ceil(content.length / config.chunkSize)),
      );
      const sentencesPerChunk = Math.ceil(sentences.length / targetChunks);

      const chunks: string[] = [];
      for (let i = 0; i < sentences.length; i += sentencesPerChunk) {
        const chunkSentences = sentences.slice(i, i + sentencesPerChunk);
        const chunk = chunkSentences.join(' ');
        if (chunk.trim().length > 0) {
          chunks.push(chunk);
        }
      }

      // Filter by minimum size but ensure we have at least 2 chunks if we started with multiple sentences
      const validChunks = chunks.filter(
        (chunk) => chunk.trim().length >= config.minChunkSize,
      );
      if (validChunks.length >= 2) {
        return validChunks;
      } else if (chunks.length >= 2 && sentences.length >= 2) {
        // If filtering by minChunkSize eliminated too many chunks, return at least 2
        return chunks.slice(0, 2);
      }
    }

    // Fallback to original logic for single sentence or edge cases
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const testChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

      if (testChunk.length <= config.chunkSize) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks.length > 1
      ? chunks
      : sentences.length > 1
        ? sentences.slice(0, 2)
        : chunks;
  }

  private chunkByParagraphs(content: string, config: ChunkingConfig): string[] {
    const paragraphs = content
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;

      if (testChunk.length <= config.chunkSize) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) chunks.push(currentChunk);

        // If single paragraph is too large, split it
        if (paragraph.length > config.chunkSize) {
          chunks.push(...CharacterChunker.chunk(paragraph, config));
          currentChunk = '';
        } else {
          currentChunk = paragraph;
        }
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  private chunkMarkdown(content: string, config: ChunkingConfig): string[] {
    // Use semantic chunking with markdown-specific patterns
    return SemanticChunker.chunk(content, config, 'markdown');
  }

  private chunkCode(content: string, config: ChunkingConfig): string[] {
    // Split by functions/classes first, then by blocks
    const functionRegex = /(?:function|def|class|interface|type)\s+\w+/g;
    const functionMatches: RegExpExecArray[] = [];
    let match = functionRegex.exec(content);

    while (match !== null) {
      functionMatches.push(match);
      match = functionRegex.exec(content);
    }

    if (functionMatches.length > 0) {
      const chunks: string[] = [];
      let currentChunk = '';
      let lastEnd = 0;

      for (let i = 0; i < functionMatches.length; i++) {
        const functionMatch = functionMatches[i];
        const nextMatch = functionMatches[i + 1];

        if (functionMatch.index !== undefined) {
          // Add any content before this function
          const beforeContent = content
            .slice(lastEnd, functionMatch.index)
            .trim();
          if (beforeContent.length > 0) {
            currentChunk += `${beforeContent}\n`;
          }

          // Find the end of this function/class
          let functionEnd = nextMatch?.index || content.length;

          // Try to find the actual end of the function by looking for balanced braces
          const functionStart = functionMatch.index;
          let braceCount = 0;
          let inString = false;
          let stringChar = '';

          for (let j = functionStart; j < content.length; j++) {
            const char = content[j];
            const prevChar = j > 0 ? content[j - 1] : '';

            // Handle string literals
            if ((char === '"' || char === "'") && prevChar !== '\\') {
              if (!inString) {
                inString = true;
                stringChar = char;
              } else if (char === stringChar) {
                inString = false;
              }
            }

            if (!inString) {
              if (char === '{') braceCount++;
              if (char === '}') braceCount--;

              // Found the closing brace for the function
              if (
                braceCount === 0 &&
                j > functionStart + functionMatch[0].length
              ) {
                functionEnd = j + 1;
                break;
              }
            }
          }

          const functionContent = content.slice(functionStart, functionEnd);

          // Check if adding this function exceeds chunk size
          if (
            currentChunk.length + functionContent.length > config.chunkSize &&
            currentChunk.length > 0
          ) {
            chunks.push(currentChunk.trim());
            currentChunk = functionContent;
          } else {
            currentChunk += functionContent;
          }

          lastEnd = functionEnd;
        }
      }

      // Add any remaining content
      if (lastEnd < content.length) {
        const remaining = content.slice(lastEnd).trim();
        if (remaining.length > 0) {
          if (
            currentChunk.length + remaining.length > config.chunkSize &&
            currentChunk.length > 0
          ) {
            chunks.push(currentChunk.trim());
            if (remaining.length >= config.minChunkSize) {
              chunks.push(remaining);
            }
          } else {
            currentChunk += `\n${remaining}`;
          }
        }
      }

      if (currentChunk.trim().length >= config.minChunkSize) {
        chunks.push(currentChunk.trim());
      }

      return chunks.length > 0
        ? chunks
        : RecursiveChunker.chunk(content, config, 'code');
    }

    return RecursiveChunker.chunk(content, config, 'code');
  }

  private detectChunkType(
    chunk: string,
    documentType?: string,
  ): ChunkMetadata['chunkType'] {
    if (documentType === 'code') return 'code';
    if (chunk.match(/^#{1,6}\s/)) return 'heading';
    if (chunk.match(/^\s*[-*+]\s/)) return 'list';
    if (chunk.match(/\|.*\|/)) return 'table';
    // Check if chunk contains paragraph-like content (not just code or lists)
    if (
      chunk.match(/[a-zA-Z]{10,}/) &&
      !chunk.match(/^\s*[-*+]\s/) &&
      !chunk.match(/^#{1,6}\s/)
    )
      return 'paragraph';
    return 'text';
  }

  private estimateTokens(content: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(content.length / 4);
  }

  private calculateBoundaryCoverage(
    chunks: DocumentChunk[],
    originalContent: string,
  ): number {
    const coveredLength = chunks.reduce(
      (total, chunk) => total + chunk.boundaries.end - chunk.boundaries.start,
      0,
    );
    return coveredLength / originalContent.length;
  }

  updateConfig(newConfig: Partial<ChunkingConfig>): void {
    this.config = ChunkingConfig.parse({ ...this.config, ...newConfig });
  }

  getConfig(): ChunkingConfig {
    return this.config;
  }
}

// Factory functions
export function createChunkingService(
  config?: Partial<ChunkingConfig>,
): DocumentChunkingService {
  return new DocumentChunkingService(config);
}

export async function chunkDocument(
  document: Document,
  config?: Partial<ChunkingConfig>,
): Promise<ChunkingResult> {
  const service = createChunkingService(config);
  return await service.chunkDocument(document);
}

// Utility functions for backward compatibility
export function createSimpleChunks(
  content: string,
  chunkSize = 1500,
  overlap = 200,
): string[] {
  return CharacterChunker.chunk(content, {
    strategy: 'character',
    chunkSize,
    chunkOverlap: overlap,
    preserveStructure: false,
    respectBoundaries: true,
    minChunkSize: 100,
    maxChunkSize: chunkSize,
    enableQualityValidation: false,
  });
}

export function createSemanticChunks(
  content: string,
  documentType?: string,
  config?: Partial<ChunkingConfig>,
): string[] {
  const fullConfig = ChunkingConfig.parse(config || {});
  return SemanticChunker.chunk(content, fullConfig, documentType);
}
