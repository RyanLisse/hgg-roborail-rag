import { BaseAgent } from './base-agent';
import type { AgentRequest, AgentResponse } from './types';
import { AgentResponse as AgentResponseSchema } from './types';

/**
 * Planner Agent - Breaks down complex queries into manageable sub-questions and tasks
 *
 * Specializes in:
 * - Breaking complex queries into sub-questions
 * - Creating step-by-step plans
 * - Task prioritization and sequencing
 * - Identifying information dependencies
 */
export class PlannerAgent extends BaseAgent {
  constructor() {
    super('planner', {
      name: 'Planner Agent',
      description:
        'Breaks down complex queries into structured plans and sub-questions',
      supportsStreaming: true,
      requiresTools: false,
      maxTokens: 2000,
      temperature: 0.2,
    });
  }

  getSystemPrompt(request: AgentRequest): string {
    const complexity = request.context?.complexity || 'moderate';

    return `You are an expert planning and analysis assistant specialized in breaking down complex problems and queries.

Your core capabilities include:
- Decomposing complex questions into manageable sub-questions
- Creating structured, step-by-step plans
- Identifying information dependencies and prerequisites
- Prioritizing tasks and questions by importance and logical sequence
- Recognizing when tasks can be parallelized vs. must be sequential

Current task complexity: ${complexity.toUpperCase()}

${
  complexity === 'complex'
    ? `
COMPLEX PLANNING MODE:
- Break down into 5-10 distinct sub-questions or tasks
- Identify critical dependencies between steps
- Prioritize high-impact, foundational questions first
- Consider multiple approaches and potential challenges
- Plan for iterative refinement`
    : complexity === 'moderate'
      ? `
MODERATE PLANNING MODE:
- Break down into 3-5 manageable sub-questions or tasks
- Establish clear logical sequence
- Identify any prerequisites or dependencies
- Balance thoroughness with efficiency`
      : `
SIMPLE PLANNING MODE:
- Break down into 2-3 focused sub-questions
- Maintain clear, direct approach
- Prioritize immediate actionable steps`
}

Planning Framework:
1. ANALYSIS: Understand the core objective and scope
2. DECOMPOSITION: Break into logical components
3. SEQUENCING: Arrange in optimal order
4. DEPENDENCIES: Identify what depends on what
5. PRIORITIZATION: Rank by importance and urgency

Output Format:
- Main Objective: [Clear statement of the overall goal]
- Sub-Questions/Tasks: [Numbered list with brief rationale]
- Execution Sequence: [Recommended order with dependencies noted]
- Success Criteria: [How to measure completion]

Focus on creating actionable, well-structured plans that make complex problems manageable.`;
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const response = await super.processRequest(request);

    // Extract sub-questions from the response content
    const subQuestions = this.extractSubQuestions(response.content);

    // Add sub-questions to metadata
    return AgentResponseSchema.parse({
      ...response,
      metadata: {
        ...response.metadata,
        subQuestions,
      },
    });
  }

  private extractSubQuestions(content: string): string[] {
    const subQuestions: string[] = [];

    // Look for numbered lists or bullet points that appear to be questions/tasks
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Match numbered items: "1. Question" or "1) Question"
      const numberedMatch = trimmed.match(/^\d+[.)]\s*(.+)/);
      if (numberedMatch) {
        subQuestions.push(numberedMatch[1]);
        continue;
      }

      // Match bullet points: "- Question" or "• Question"
      const bulletMatch = trimmed.match(/^[-•*]\s*(.+)/);
      if (bulletMatch) {
        subQuestions.push(bulletMatch[1]);
        continue;
      }

      // Look for lines that end with question marks
      if (trimmed.endsWith('?') && trimmed.length > 10) {
        subQuestions.push(trimmed);
      }
    }

    return subQuestions.slice(0, 10); // Limit to 10 sub-questions
  }

  protected getTools(request: AgentRequest): Record<string, any> | undefined {
    // Planner agent doesn't require special tools
    return undefined;
  }
}
