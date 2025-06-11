import type { UserType } from '@/app/(auth)/auth';
import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 20,
    availableChatModelIds: [
      'openai-gpt-4.1',
      'openai-o4-mini',
      'anthropic-claude-4-sonnet',
      'google-gemini-1.5-flash-latest',
      'groq-mixtral-8x7b-32768',
    ],
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [
      'openai-gpt-4.1',
      'openai-o4-mini',
      'openai-o3-pro',
      'anthropic-claude-4-sonnet',
      'anthropic-claude-4-opus',
      'google-gemini-1.5-pro-latest',
      'google-gemini-1.5-flash-latest',
      'cohere-command-a-03-2025',
      'cohere-command-r-plus',
      'groq-mixtral-8x7b-32768',
      'groq-llama3-70b-8192',
    ],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
