/**
 * Test utilities index
 * Centralized exports for all test utility modules
 * Use this file for importing test utilities to maintain consistency
 */

// Core factories and mocks
export * from './mock-factories';
export * from './mock-providers';
// Assertions and matchers
export * from './test-assertions';
// Configuration and constants
export * from './test-config';

// Playwright-specific helpers (for e2e tests)
export * from './test-helpers';

// Re-export commonly used utilities with convenient names
import mockFactories from './mock-factories';
import { mockRegistry } from './mock-providers';
import testAssertions from './test-assertions';
import testConfig, { performanceUtils } from './test-config';

// Convenient grouped exports
export const factories = mockFactories;
export const mocks = mockRegistry;
export const config = testConfig;
export const assertions = testAssertions;

// Quick access to most commonly used utilities
export const {
  createMockUser,
  createMockSession,
  createMockMessage,
  createMockAPIResponse,
  createMockVectorSearchResult,
} = mockFactories;

export const { testUtils, mockPresets } = mockRegistry;

export const { TEST_CONFIG, TEST_CONSTANTS, configUtils, performanceUtils } =
  testConfig;

export const { assertUtils, customMatchers, snapshotUtils } = testAssertions;

// Default export with all utilities organized
export default {
  // Factories for creating test data
  factories: mockFactories,

  // Mock implementations
  mocks: mockRegistry,

  // Configuration and constants
  config: testConfig,

  // Assertion utilities
  assertions: testAssertions,

  // Quick setup functions for different test types
  setupUnit: () => mockRegistry.presets.unit(),
  setupIntegration: () => mockRegistry.presets.integration(),
  setupE2E: () => mockRegistry.presets.e2e(),

  // Performance testing
  measurePerformance: testConfig.performance.measureTime,

  // Common test patterns
  patterns: {
    // Create a complete test user with session
    createAuthenticatedUser: () => {
      const user = mockFactories.createMockUser();
      const session = mockFactories.createMockSession({ id: user.id });
      return { user, session };
    },

    // Create a chat conversation for testing
    createTestConversation: (messageCount = 3) => {
      return mockFactories.createMockChatConversation(messageCount);
    },

    // Create API test scenario
    createAPITestScenario: (
      endpoint: string,
      method = 'GET',
      expectedStatus = 200,
    ) => {
      return {
        endpoint,
        method,
        expectedStatus,
        response: mockFactories.createMockAPIResponse(
          {},
          { status: expectedStatus },
        ),
      };
    },

    // Create vector search test scenario
    createVectorSearchScenario: (query: string, resultCount = 5) => {
      return {
        query,
        results: mockFactories.createMockBatch(
          mockFactories.createMockVectorSearchResult,
          resultCount,
        ),
      };
    },
  },
};
