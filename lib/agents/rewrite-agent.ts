import { BaseAgent } from "./base-agent";
import type { AgentRequest } from "./types";

/**
 * Rewrite Agent - Specialized in rephrasing, summarizing, and reformulating content
 *
 * Specializes in:
 * - Query rephrasing and optimization
 * - Text summarization
 * - Content restructuring
 * - Style and tone adjustments
 */
export class RewriteAgent extends BaseAgent {
  constructor() {
    super("rewrite", {
      name: "Rewrite Agent",
      description:
        "Specializes in rephrasing, summarizing, and reformulating text content",
      supportsStreaming: true,
      requiresTools: false,
      maxTokens: 1500,
      temperature: 0.3,
    });
  }

  getSystemPrompt(request: AgentRequest): string {
    const taskIndicators = this.detectRewriteTask(request.query);

    return `You are an expert writing assistant specialized in text transformation and optimization.

Your core capabilities include:
- Rephrasing and reformulating content for clarity and impact
- Summarizing complex information into concise, digestible formats
- Optimizing queries for better search and understanding
- Adjusting tone, style, and reading level as needed
- Improving structure and flow of text

${
  taskIndicators.includes("summarize")
    ? `
SUMMARIZATION TASK DETECTED:
- Extract key points and main ideas
- Maintain essential information while reducing length
- Use clear, concise language
- Structure information hierarchically when appropriate`
    : ""
}

${
  taskIndicators.includes("rephrase")
    ? `
REPHRASING TASK DETECTED:
- Maintain original meaning while improving clarity
- Use more accessible or appropriate language
- Improve sentence structure and flow
- Consider the intended audience`
    : ""
}

${
  taskIndicators.includes("optimize")
    ? `
QUERY OPTIMIZATION TASK DETECTED:
- Enhance specificity and clarity
- Add relevant context and keywords
- Structure for better information retrieval
- Maintain user intent while improving precision`
    : ""
}

Guidelines:
- Preserve the core meaning and intent
- Improve clarity and readability
- Use appropriate tone and style
- Be concise without losing important details
- Explain significant changes when helpful

Focus on making the content more effective for its intended purpose.`;
  }

  private detectRewriteTask(query: string): string[] {
    const indicators: string[] = [];
    const lowerQuery = query.toLowerCase();

    if (
      lowerQuery.includes("summarize") ||
      lowerQuery.includes("summary") ||
      lowerQuery.includes("brief") ||
      lowerQuery.includes("condense")
    ) {
      indicators.push("summarize");
    }

    if (
      lowerQuery.includes("rephrase") ||
      lowerQuery.includes("rewrite") ||
      lowerQuery.includes("reword") ||
      lowerQuery.includes("reformulate")
    ) {
      indicators.push("rephrase");
    }

    if (
      lowerQuery.includes("optimize") ||
      lowerQuery.includes("improve") ||
      lowerQuery.includes("enhance") ||
      lowerQuery.includes("better")
    ) {
      indicators.push("optimize");
    }

    return indicators;
  }

  protected getTools(request: AgentRequest): Record<string, any> | undefined {
    // Rewrite agent doesn't require special tools
    return;
  }
}
