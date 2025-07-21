import { describe, expect, it } from "vitest";
import type { UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "./entitlements";

describe("Entitlements", () => {
  describe("entitlementsByUserType", () => {
    it("should have entitlements for guest users", () => {
      const guestEntitlements = entitlementsByUserType.guest;

      expect(guestEntitlements).toBeDefined();
      expect(guestEntitlements.maxMessagesPerDay).toBe(20);
      expect(guestEntitlements.availableChatModelIds).toBeInstanceOf(Array);
      expect(guestEntitlements.availableChatModelIds.length).toBeGreaterThan(0);
    });

    it("should have entitlements for regular users", () => {
      const regularEntitlements = entitlementsByUserType.regular;

      expect(regularEntitlements).toBeDefined();
      expect(regularEntitlements.maxMessagesPerDay).toBe(100);
      expect(regularEntitlements.availableChatModelIds).toBeInstanceOf(Array);
      expect(regularEntitlements.availableChatModelIds.length).toBeGreaterThan(
        0,
      );
    });

    it("should give regular users more message quota than guests", () => {
      const guestQuota = entitlementsByUserType.guest.maxMessagesPerDay;
      const regularQuota = entitlementsByUserType.regular.maxMessagesPerDay;

      expect(regularQuota).toBeGreaterThan(guestQuota);
    });

    it("should give regular users more model options than guests", () => {
      const guestModels = entitlementsByUserType.guest.availableChatModelIds;
      const regularModels =
        entitlementsByUserType.regular.availableChatModelIds;

      expect(regularModels.length).toBeGreaterThan(guestModels.length);
    });

    it("should include default models for both user types", () => {
      const guestModels = entitlementsByUserType.guest.availableChatModelIds;
      const regularModels =
        entitlementsByUserType.regular.availableChatModelIds;

      // Core models that should be available to both (updated for OpenAI/Google only)
      const coreModels = [
        "openai-gpt-4.1",
        "openai-o4-mini", 
        "google-gemini-1.5-flash-latest",
      ];

      coreModels.forEach((model) => {
        expect(guestModels).toContain(model);
        expect(regularModels).toContain(model);
      });
    });

    it("should include premium models only for regular users", () => {
      const guestModels = entitlementsByUserType.guest.availableChatModelIds;
      const regularModels =
        entitlementsByUserType.regular.availableChatModelIds;

      // Updated premium models for OpenAI/Google only  
      const premiumModels = [
        "openai-o3-pro",
        "google-gemini-1.5-pro-latest",
      ];

      premiumModels.forEach((model) => {
        expect(guestModels).not.toContain(model);
        expect(regularModels).toContain(model);
      });
    });

    it("should have valid model ID format", () => {
      const allUserTypes: UserType[] = ["guest", "regular"];

      allUserTypes.forEach((userType) => {
        const entitlements = entitlementsByUserType[userType];
        entitlements.availableChatModelIds.forEach((modelId) => {
          // Model IDs should follow pattern: provider-model-version
          expect(modelId).toMatch(/^[a-z]+-[a-z0-9.-]+$/);
          expect(modelId.length).toBeGreaterThan(0);
        });
      });
    });

    it("should have no duplicate model IDs per user type", () => {
      const allUserTypes: UserType[] = ["guest", "regular"];

      allUserTypes.forEach((userType) => {
        const models = entitlementsByUserType[userType].availableChatModelIds;
        const uniqueModels = [...new Set(models)];

        expect(models.length).toBe(uniqueModels.length);
      });
    });

    it("should have reasonable message limits", () => {
      const guestLimit = entitlementsByUserType.guest.maxMessagesPerDay;
      const regularLimit = entitlementsByUserType.regular.maxMessagesPerDay;

      // Sanity checks for reasonable limits
      expect(guestLimit).toBeGreaterThan(0);
      expect(guestLimit).toBeLessThan(1000);
      expect(regularLimit).toBeGreaterThan(0);
      expect(regularLimit).toBeLessThan(10_000);
    });

    it("should maintain provider diversity", () => {
      const regularModels =
        entitlementsByUserType.regular.availableChatModelIds;
      const providers = new Set(
        regularModels.map((model) => model.split("-")[0]),
      );

      // Should support multiple providers (updated for OpenAI/Google only)
      expect(providers.size).toBeGreaterThanOrEqual(2);
      expect(providers).toContain("openai");
      expect(providers).toContain("google");
    });

    it("should be extensible for future user types", () => {
      // The entitlements structure should support adding new user types
      expect(typeof entitlementsByUserType).toBe("object");

      // Should have the expected structure for each user type
      Object.values(entitlementsByUserType).forEach((entitlement) => {
        expect(entitlement).toHaveProperty("maxMessagesPerDay");
        expect(entitlement).toHaveProperty("availableChatModelIds");
        expect(typeof entitlement.maxMessagesPerDay).toBe("number");
        expect(Array.isArray(entitlement.availableChatModelIds)).toBe(true);
      });
    });
  });
});
