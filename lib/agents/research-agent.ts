import { BaseAgent } from './base-agent';
import type { AgentRequest, AgentResponse } from './types';
import { AgentResponse as AgentResponseSchema } from './types';

/**
 * Research Agent - Deep research using enhanced search with comprehensive citations
 *
 * Specializes in:
 * - Comprehensive information gathering
 * - Multi-source research synthesis
 * - Citation management and source attribution
 * - In-depth analysis and investigation
 */
export class ResearchAgent extends BaseAgent {
  constructor() {
    super('research', {
      name: 'Research Agent',
      description:
        'Conducts comprehensive research with enhanced search and detailed citations',
      supportsStreaming: true,
      requiresTools: true,
      maxTokens: 3000,
      temperature: 0.1,
    });
  }

  getSystemPrompt(request: AgentRequest): string {
    const requiresCitations = request.context?.requiresCitations ?? true;
    const domainKeywords = request.context?.domainKeywords || [];

    return `You are an expert research analyst specialized in comprehensive information gathering and synthesis.

Your research methodology includes:
- Systematic information gathering from multiple sources
- Critical evaluation of source credibility and relevance
- Synthesis of information across different perspectives
- Comprehensive citation and source attribution
- Identification of knowledge gaps and areas for further investigation

${
  domainKeywords.length > 0
    ? `
DOMAIN FOCUS: ${domainKeywords.join(', ')}
- Pay special attention to domain-specific terminology and concepts
- Consider field-specific perspectives and methodologies
- Look for authoritative sources within this domain`
    : ''
}

Research Standards:
- Gather information from multiple sources when possible
- Evaluate source quality, recency, and relevance
- Present balanced perspectives on complex topics
- Distinguish between facts, opinions, and speculation
- Acknowledge limitations and uncertainties in available information

${
  requiresCitations
    ? `
CITATION REQUIREMENTS:
- Provide detailed source attribution for all claims
- Include source titles, authors, and publication information when available
- Use consistent citation format throughout
- Distinguish between primary and secondary sources
- Note the confidence level for different pieces of information`
    : ''
}

Research Structure:
1. EXECUTIVE SUMMARY: Key findings and main conclusions
2. DETAILED FINDINGS: Comprehensive information organized by topic
3. SOURCE ANALYSIS: Evaluation of source quality and reliability
4. LIMITATIONS: Areas where information is incomplete or uncertain
5. RECOMMENDATIONS: Suggestions for further research if applicable

Output Format:
- Use clear headings and subheadings
- Present information in logical, hierarchical structure
- Include direct quotes when particularly relevant
- Provide context for technical terms and concepts
- Synthesize rather than just aggregate information

Focus on providing thorough, well-researched responses that advance understanding of the topic.`;
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    // Set context to require citations for research tasks
    const researchRequest: AgentRequest = {
      ...request,
      context: {
        ...request.context,
        sources: request.context?.sources || ['memory'],
        requiresCitations: true,
        maxResults: Math.max(request.context?.maxResults || 5, 8), // Research needs more sources
        complexity: request.context?.complexity || 'complex',
        domainKeywords: request.context?.domainKeywords || [],
      },
    };

    const response = await super.processRequest(researchRequest);

    // Extract citations from the response content
    const citations = this.extractCitations(response.content);

    // Add citations to metadata
    return AgentResponseSchema.parse({
      ...response,
      metadata: {
        ...response.metadata,
        citations,
      },
    });
  }

  private extractCitations(content: string): string[] {
    const citations: string[] = [];

    // Look for various citation patterns in the content
    const citationPatterns = [
      // [Source: Title] or [Source Name]
      /\[([^\]]+)\]/g,
      // (Source, Year) or (Author Year)
      /\(([^)]+(?:\d{4})[^)]*)\)/g,
      // Direct source mentions
      /(?:according to|source:|from|via)\s+([^.!?]+)/gi,
    ];

    for (const pattern of citationPatterns) {
      let match: RegExpExecArray | null = pattern.exec(content);
      while (match !== null) {
        const citation = match[1].trim();
        if (citation.length > 3 && citation.length < 200) {
          citations.push(citation);
        }
        match = pattern.exec(content);
      }
    }

    // Also extract any URLs if present
    const urlPattern = /https?:\/\/[^\s]+/g;
    let urlMatch: RegExpExecArray | null = urlPattern.exec(content);
    while (urlMatch !== null) {
      citations.push(urlMatch[0]);
      urlMatch = urlPattern.exec(content);
    }

    // Remove duplicates and return unique citations
    return Array.from(new Set(citations)).slice(0, 20); // Limit to 20 citations
  }

  protected getTools(_request: AgentRequest): Record<string, any> | undefined {
    // Research agent could use enhanced search tools if available
    // This would be expanded to include web search, academic databases, etc.
    return {
      // Placeholder for future research-specific tools
      // webSearch: webSearchTool,
      // academicSearch: academicSearchTool,
      // factCheck: factCheckTool,
    };
  }
}
