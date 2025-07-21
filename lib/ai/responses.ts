import "server-only";

import OpenAI from "openai";
import { getOpenAIVectorStoreService } from "@/lib/vectorstore/openai";
import { OPENAI_API_KEY } from "../env";

export interface SourceAnnotation {
  id: string;
  type: "file_citation" | "file_path";
  text: string;
  start_index: number;
  end_index: number;
  file_citation?: {
    file_id: string;
    quote?: string;
  };
  file_path?: {
    file_id: string;
  };
}

export interface ResponseWithSources {
  content: string;
  annotations: SourceAnnotation[];
  sources: SourceFile[];
}

export interface SourceFile {
  id: string;
  name: string;
  url?: string;
}

export interface ResponsesAPIConfig {
  model: string;
  input: string;
  vectorStoreIds?: string[];
  maxResults?: number;
}

/**
 * Enhanced OpenAI Responses API wrapper with comprehensive source handling
 */
export class OpenAIResponsesService {
  private client: OpenAI;
  private isEnabled: boolean;

  constructor() {
    const apiKey = OPENAI_API_KEY;
    this.isEnabled = !!apiKey;

    if (!this.isEnabled) {
      console.warn(
        "OpenAI Responses API service is disabled - no API key provided",
      );
      this.client = null as any; // Initialize to avoid undefined
      return;
    }

    this.client = new OpenAI({ apiKey });
  }

  /**
   * Create a response with file search and extract sources
   */
  async createResponseWithSources(
    config: ResponsesAPIConfig,
  ): Promise<ResponseWithSources> {
    if (!this.isEnabled) {
      throw new Error(
        "OpenAI Responses API service is disabled - no API key provided",
      );
    }

    const { model, input, vectorStoreIds, maxResults = 20 } = config;

    try {
      // Get vector store IDs from config or default service
      let targetVectorStoreIds = vectorStoreIds;
      if (!targetVectorStoreIds || targetVectorStoreIds.length === 0) {
        const vectorService = await getOpenAIVectorStoreService();
        if (vectorService.isEnabled && vectorService.defaultVectorStoreId) {
          targetVectorStoreIds = [vectorService.defaultVectorStoreId];
        } else {
          throw new Error(
            "No vector store IDs provided and no default configured",
          );
        }
      }

      console.log(
        `🔍 Creating response with file search for vector stores: ${targetVectorStoreIds.join(", ")}`,
      );

      // Use OpenAI Responses API with file search
      const response = await this.client.responses.create({
        model,
        input,
        tools: [
          {
            type: "file_search",
            vector_store_ids: targetVectorStoreIds,
            max_num_results: maxResults,
          },
        ],
        include: ["file_search_call.results"],
      });

      const responseData = response as any;
      console.log("📄 Response received:", {
        id: responseData.id,
        hasAnnotations: responseData.output?.[0]?.content?.length > 0,
        outputLength: responseData.output?.length || 0,
      });

      // Extract content and annotations
      const content = responseData.output?.[0]?.content || "";
      const annotations = responseData.output?.[0]?.annotations || [];

      // Extract unique source files from annotations
      const sourceFileIds = new Set<string>();
      annotations.forEach((annotation: any) => {
        if (annotation.file_citation?.file_id) {
          sourceFileIds.add(annotation.file_citation.file_id);
        }
        if (annotation.file_path?.file_id) {
          sourceFileIds.add(annotation.file_path.file_id);
        }
      });

      // Fetch file information for sources
      const sources = await this.getSourceFiles(Array.from(sourceFileIds));

      return {
        content: this.processContentWithCitations(content, annotations),
        annotations,
        sources,
      };
    } catch (error) {
      console.error("Error in OpenAI Responses API:", error);
      throw error;
    }
  }

  /**
   * Process content to replace citation markers with numbered references
   */
  private processContentWithCitations(
    content: string,
    annotations: SourceAnnotation[],
  ): string {
    if (!annotations.length) return content;

    let processedContent = content;
    const citationMap = new Map<string, number>();
    let citationCounter = 1;

    // Sort annotations by start_index in descending order to avoid index shifts
    const sortedAnnotations = [...annotations].sort(
      (a, b) => b.start_index - a.start_index,
    );

    sortedAnnotations.forEach((annotation) => {
      if (
        annotation.type === "file_citation" &&
        annotation.file_citation?.file_id
      ) {
        const fileId = annotation.file_citation.file_id;

        // Get or assign citation number
        if (!citationMap.has(fileId)) {
          citationMap.set(fileId, citationCounter++);
        }
        const citationNumber = citationMap.get(fileId);

        // Replace annotation text with numbered citation
        const before = processedContent.substring(0, annotation.start_index);
        const after = processedContent.substring(annotation.end_index);
        processedContent = `${before}[${citationNumber}]${after}`;
      }
    });

    return processedContent;
  }

  /**
   * Fetch file information for source citations
   */
  private async getSourceFiles(fileIds: string[]): Promise<SourceFile[]> {
    if (!fileIds.length) return [];

    const sources: SourceFile[] = [];

    for (const fileId of fileIds) {
      try {
        const file = await this.client.files.retrieve(fileId);
        sources.push({
          id: file.id,
          name: file.filename || `File ${file.id}`,
          url: undefined, // OpenAI files don't have public URLs
        });
      } catch (error) {
        console.error(`Failed to retrieve file ${fileId}:`, error);
        // Add placeholder for failed file retrieval
        sources.push({
          id: fileId,
          name: `Unknown file (${fileId})`,
          url: undefined,
        });
      }
    }

    return sources;
  }

  /**
   * Format citations for display
   */
  static formatCitations(sources: SourceFile[]): string {
    if (!sources.length) return "";

    const citations = sources.map((source, index) => {
      return `[${index + 1}] ${source.name}`;
    });

    return `\n\n**Sources:**\n${citations.join("\n")}`;
  }

  /**
   * Extract quoted text from annotations
   */
  static extractQuotes(annotations: SourceAnnotation[]): string[] {
    return annotations
      .filter(
        (annotation) =>
          annotation.type === "file_citation" &&
          annotation.file_citation?.quote,
      )
      .map((annotation) => annotation.file_citation?.quote)
      .filter(
        (quote): quote is string => quote !== undefined && quote !== null,
      );
  }
}

// Singleton service
let responsesService: OpenAIResponsesService | null = null;

export function getOpenAIResponsesService(): OpenAIResponsesService {
  if (!responsesService) {
    responsesService = new OpenAIResponsesService();
  }
  return responsesService;
}
