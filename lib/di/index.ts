/**
 * Dependency Injection System
 * Entry point for DI container and service management
 */

// Re-export core DI functionality
export {
  type DIContainer,
  getContainer,
  isRegistered,
  registerScoped,
  registerSingleton,
  registerTransient,
  resetContainer,
  resolve,
  ScopedContainer,
  type ServiceDescriptor,
  type ServiceLifetime,
  ServiceTokens,
  SimpleDIContainer,
  setContainer,
} from "./container";

// Re-export service management
export {
  createRequestScope,
  getService,
  hasService,
  initializeServices,
} from "./services";

import { getContainer, ServiceTokens } from "./container";
// Import for direct use
import { initializeServices } from "./services";

/**
 * Initialize the DI system
 * Call this on application startup
 */
export function initializeDI(): void {
  // Initialize all services
  initializeServices();

  console.log("✅ Dependency injection system initialized");
}

/**
 * Helper to check if DI is initialized
 */
export function isDIInitialized(): boolean {
  return getContainer().isRegistered(ServiceTokens.CONFIG);
}
