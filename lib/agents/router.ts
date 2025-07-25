import { generateText } from 'ai';
import { getModelInstance } from '../ai/providers';
import { getUnifiedVectorStoreService } from '../vectorstore/unified';
import type {
  AgentRequest,
  AgentRouter,
  AgentRoutingDecision,
  AgentType,
  QueryComplexity,
  UserIntent,
  VectorStoreType,
} from './types';
import {
  AgentRoutingDecision as AgentRoutingDecisionSchema,
  QueryComplexity as QueryComplexitySchema,
} from './types';

export class SmartAgentRouter implements AgentRouter {
  private readonly routingModel = 'openai-gpt-4.1-mini'; // Fast model for routing decisions

  async routeQuery(
    query: string,
    _context?: AgentRequest['context'],
  ): Promise<AgentRoutingDecision> {
    try {
      // Analyze query in parallel
      const [intent, complexity, availableSources] = await Promise.all([
        this.classifyIntent(query),
        this.analyzeComplexity(query),
        this.getAvailableSources(),
      ]);

      // Select agent based on analysis
      const selectedAgent = this.selectAgent(
        intent,
        complexity,
        availableSources,
      );
      const fallbackAgent = this.getFallbackAgent(selectedAgent);
      const confidence = this.calculateRoutingConfidence(
        intent,
        complexity,
        query,
      );
      const reasoning = this.generateRoutingReasoning(
        selectedAgent,
        intent,
        complexity,
      );
      const suggestedSources = this.selectOptimalSources(
        intent,
        selectedAgent,
        availableSources,
      );

      return AgentRoutingDecisionSchema.parse({
        selectedAgent,
        confidence,
        reasoning,
        fallbackAgent,
        suggestedSources,
        estimatedComplexity: complexity.level,
      });
    } catch (_error) {

      // Fallback to QA agent on any error
      return AgentRoutingDecisionSchema.parse({
        selectedAgent: 'qa',
        confidence: 0.5,
        reasoning: 'Fallback to QA agent due to routing error',
        fallbackAgent: 'research',
        suggestedSources: ['openai'],
        estimatedComplexity: 'moderate',
      });
    }
  }

  async classifyIntent(query: string): Promise<UserIntent> {
    const prompt = `Classify the user intent for this query. Respond with only one of these categories:
- question_answering: Direct questions seeking factual information
- summarization: Requests to summarize or condense information
- rewriting: Requests to rephrase, rewrite, or reformulate text
- planning: Requests to break down complex tasks or create plans
- research: Requests for comprehensive investigation or analysis
- comparison: Requests to compare multiple items or concepts
- analysis: Requests for deep analysis or evaluation
- general_chat: Casual conversation or unclear intent

Query: "${query}"

Intent:`;

    try {
      const { text } = await generateText({
        model: getModelInstance(this.routingModel),
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 50,
        temperature: 0.1,
      });

      const intent = text.trim().toLowerCase();

      // Map response to valid intent
      if (intent.includes('question') || intent.includes('factual')) {
        return 'question_answering';
      }
      if (intent.includes('summar')) { return 'summarization'; }
      if (intent.includes('rewrit') || intent.includes('rephras')) {
        return 'rewriting';
      }
      if (intent.includes('plan')) { return 'planning'; }
      if (intent.includes('research') || intent.includes('investigat')) {
        return 'research';
      }
      if (intent.includes('compar')) { return 'comparison'; }
      if (intent.includes('analy')) { return 'analysis'; }

      return 'question_answering'; // Default fallback
    } catch (error) {
      console.warn('Intent classification failed, defaulting to question_answering:', error);
      return 'question_answering';
    }
  }

  async analyzeComplexity(query: string): Promise<QueryComplexity> {
    const words = query.split(/\s+/).length;
    const questions = (query.match(/\?/g) || []).length;
    const technicalTerms = this.countTechnicalTerms(query);

    // Heuristic analysis
    const requiresMultipleSteps = this.detectMultiStepQuery(query);
    const requiresExternalData = this.detectExternalDataNeed(query);
    const requiresSynthesis = this.detectSynthesisNeed(query);

    // Calculate complexity score
    let score = 0;
    score += Math.min(words / 50, 0.3); // Word count factor
    score += Math.min(questions * 0.1, 0.2); // Multiple questions
    score += Math.min(technicalTerms * 0.05, 0.2); // Technical complexity
    score += requiresMultipleSteps ? 0.15 : 0;
    score += requiresExternalData ? 0.1 : 0;
    score += requiresSynthesis ? 0.15 : 0;

    // Determine complexity level
    let level: 'simple' | 'moderate' | 'complex';
    if (score <= 0.3) { level = 'simple'; }
    else if (score <= 0.6) { level = 'moderate'; }
    else { level = 'complex'; }

    return QueryComplexitySchema.parse({
      level,
      factors: {
        wordCount: words,
        questionCount: questions,
        technicalTerms,
        requiresMultipleSteps,
        requiresExternalData,
        requiresSynthesis,
      },
      score: Math.min(score, 1),
    });
  }

  selectAgent(
    intent: UserIntent,
    complexity: QueryComplexity,
    _availableSources: VectorStoreType[],
  ): AgentType {
    // Direct intent-to-agent mapping
    switch (intent) {
      case 'summarization':
      case 'rewriting':
        return 'rewrite';

      case 'planning':
        return 'planner';

      case 'research':
      case 'analysis':
        return 'research';

      case 'comparison':
        // Use research for complex comparisons, QA for simple ones
        return complexity.level === 'complex' ? 'research' : 'qa';

      case 'question_answering':
      case 'general_chat':
      default:
        // Select based on complexity for general questions
        if (
          complexity.level === 'complex' &&
          complexity.factors.requiresMultipleSteps
        ) {
          return 'planner';
        }
        if (
          complexity.level === 'complex' ||
          complexity.factors.requiresSynthesis
        ) {
          return 'research';
        }
        return 'qa';
    }
  }

  private getFallbackAgent(primaryAgent: AgentType): AgentType {
    // Define fallback chains
    const fallbacks: Record<AgentType, AgentType> = {
      qa: 'research',
      rewrite: 'qa',
      planner: 'qa',
      research: 'qa',
    };

    return fallbacks[primaryAgent];
  }

  private calculateRoutingConfidence(
    intent: UserIntent,
    complexity: QueryComplexity,
    query: string,
  ): number {
    let confidence = 0.7; // Base confidence

    // Boost confidence for clear intent indicators
    const lowerQuery = query.toLowerCase();
    if (
      intent === 'rewriting' &&
      (lowerQuery.includes('rewrite') || lowerQuery.includes('rephrase'))
    ) {
      confidence += 0.2;
    }
    if (
      intent === 'planning' &&
      (lowerQuery.includes('plan') || lowerQuery.includes('step'))
    ) {
      confidence += 0.2;
    }
    if (
      intent === 'research' &&
      (lowerQuery.includes('research') || lowerQuery.includes('analyze'))
    ) {
      confidence += 0.2;
    }

    // Adjust for complexity alignment
    if (complexity.level === 'simple' && intent === 'question_answering') {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private generateRoutingReasoning(
    agent: AgentType,
    intent: UserIntent,
    complexity: QueryComplexity,
  ): string {
    const reasons = [
      `Selected ${agent} agent for ${intent} task`,
      `Query complexity: ${complexity.level}`,
    ];

    if (complexity.factors.requiresMultipleSteps) {
      reasons.push('Multi-step approach needed');
    }
    if (complexity.factors.requiresSynthesis) {
      reasons.push('Information synthesis required');
    }

    return reasons.join('; ');
  }

  private selectOptimalSources(
    intent: UserIntent,
    agent: AgentType,
    available: VectorStoreType[],
  ): VectorStoreType[] {
    // Research and complex queries benefit from multiple sources
    if (agent === 'research' || intent === 'research') {
      return available.slice(0, 3); // Use up to 3 sources
    }

    // Simple QA can use fewer sources
    if (agent === 'qa' && available.includes('openai')) {
      return ['openai']; // Prioritize OpenAI for simple queries
    }

    return available.slice(0, 2); // Default to 2 sources
  }

  private async getAvailableSources(): Promise<
    ('openai' | 'neon' | 'memory')[]
  > {
    try {
      const service = await getUnifiedVectorStoreService();
      const sources = await service.getAvailableSources();
      // Filter out 'unified' since agents work with individual sources
      return sources.filter((source) => source !== 'unified') as (
        | 'openai'
        | 'neon'
        | 'memory'
      )[];
    } catch (error) {
      console.warn('Failed to get available sources, using defaults:', error);
      return ['openai', 'memory']; // Fallback sources
    }
  }

  private countTechnicalTerms(query: string): number {
    const technicalPatterns = [
      /\b\w+(?:API|SDK|HTTP|JSON|XML|SQL|ML|AI|GPU|CPU|RAM|SSD|HDD)\b/gi,
      /\b(?:algorithm|database|framework|architecture|protocol|encryption|authentication)\b/gi,
      /\b[A-Z]{2,}\b/g, // Acronyms
    ];

    let count = 0;
    for (const pattern of technicalPatterns) {
      const matches = query.match(pattern) || [];
      count += matches.length;
    }

    return count;
  }

  private detectMultiStepQuery(query: string): boolean {
    const multiStepIndicators = [
      /\b(?:first|then|next|after|finally|step|stage|phase)\b/gi,
      /\b(?:how to|what are the steps|guide|tutorial|process)\b/gi,
      /\d+\.\s|\d+\)\s/g, // Numbered lists
      /\band\s+(?:also|then|additionally)/gi,
    ];

    return multiStepIndicators.some((pattern) => pattern.test(query));
  }

  private detectExternalDataNeed(query: string): boolean {
    const externalDataIndicators = [
      /\b(?:current|latest|recent|today|this year|2024|2025)\b/gi,
      /\b(?:price|cost|rate|statistics|data|news|update)\b/gi,
      /\b(?:compare|versus|vs\.?|difference between)\b/gi,
    ];

    return externalDataIndicators.some((pattern) => pattern.test(query));
  }

  private detectSynthesisNeed(query: string): boolean {
    const synthesisIndicators = [
      /\b(?:analyze|evaluate|assess|review|examine)\b/gi,
      /\b(?:pros and cons|advantages|disadvantages|benefits|drawbacks)\b/gi,
      /\b(?:relationship|connection|correlation|impact|effect)\b/gi,
      /\b(?:comprehensive|thorough|detailed|in-depth)\b/gi,
    ];

    return synthesisIndicators.some((pattern) => pattern.test(query));
  }
}
