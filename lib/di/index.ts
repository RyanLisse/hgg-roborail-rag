/**
 * Dependency Injection System
 * Entry point for DI container and service management
 */

// Re-export core DI functionality
export {
  type DIContainer,
  type ServiceDescriptor,
  type ServiceLifetime,
  SimpleDIContainer,
  ScopedContainer,
  ServiceTokens,
  getContainer,
  setContainer,
  resetContainer,
  registerSingleton,
  registerTransient,
  registerScoped,
  resolve,
  isRegistered,
} from './container';

// Re-export service management
export {
  initializeServices,
  getService,
  hasService,
  createRequestScope,
} from './services';

// Import for direct use
import { initializeServices } from './services';
import { getContainer, ServiceTokens } from './container';

/**
 * Initialize the DI system
 * Call this on application startup
 */
export function initializeDI(): void {
  // Initialize all services
  initializeServices();

  console.log('✅ Dependency injection system initialized');
}

/**
 * Helper to check if DI is initialized
 */
export function isDIInitialized(): boolean {
  return getContainer().isRegistered(ServiceTokens.CONFIG);
}
