import type { UserType } from "@/app/(auth)/auth";
import type { ChatModel } from "./models";

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel["id"]>;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 20,
    availableChatModelIds: [
      "openai-gpt-4.1",
      "openai-o4-mini",
      "google-gemini-1.5-flash-latest",
    ],
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [
      "openai-gpt-4.1",
      "openai-o4-mini",
      "openai-o3-pro",
      "google-gemini-1.5-pro-latest",
      "google-gemini-1.5-flash-latest",
    ],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
