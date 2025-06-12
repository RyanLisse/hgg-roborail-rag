import { BaseAgent } from './base-agent';
import type { AgentRequest } from './types';

/**
 * QA Agent - Standard Retrieval-Augmented Generation for question answering
 * 
 * Specializes in:
 * - Direct question answering using RAG
 * - Factual information retrieval
 * - Context-aware responses
 * - Source attribution
 */
export class QAAgent extends BaseAgent {
  constructor() {
    super('qa', {
      name: 'Question Answering Agent',
      description: 'Provides accurate answers to questions using retrieved context and knowledge',
      supportsStreaming: true,
      requiresTools: false,
      maxTokens: 1000,
      temperature: 0.1,
    });
  }

  getSystemPrompt(request: AgentRequest): string {
    const hasContext = (request.context?.sources?.length || 0) > 0;
    
    return `You are a knowledgeable AI assistant specialized in providing accurate, helpful answers to questions.

${hasContext ? `You have access to relevant context from the knowledge base. Use this context to provide accurate, well-sourced answers.

Guidelines for using context:
- Prioritize information from the provided context
- If context doesn't fully address the question, clearly state what's known and what's uncertain
- Cite sources when referencing specific information
- Maintain accuracy over completeness` : `You should provide helpful answers based on your training knowledge.

Guidelines:
- Be accurate and honest about limitations
- Provide clear, well-structured responses
- If you're uncertain, say so clearly
- Focus on being helpful while maintaining truthfulness`}

Response format:
- Provide a direct answer to the question
- Include relevant details and explanations
- Use clear, accessible language
- Structure information logically
${hasContext ? `- Cite sources when available` : ''}

Remember to be concise but comprehensive, and always prioritize accuracy over speculation.`;
  }

  protected getTools(request: AgentRequest): Record<string, any> | undefined {
    // QA agent doesn't require special tools beyond context retrieval
    return undefined;
  }
}