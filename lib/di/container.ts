/**
 * Simple Dependency Injection Container
 * Provides service registration, resolution, and lifecycle management
 */

export type ServiceLifetime = "singleton" | "transient" | "scoped";

export interface ServiceDescriptor<T = any> {
  token: string | symbol;
  factory: (container: DIContainer) => T;
  lifetime: ServiceLifetime;
  instance?: T;
}

export interface DIContainer {
  register<T>(
    token: string | symbol,
    factory: (container: DIContainer) => T,
    lifetime?: ServiceLifetime,
  ): void;

  resolve<T>(token: string | symbol): T;

  isRegistered(token: string | symbol): boolean;

  clear(): void;

  createScope(): ScopedContainer;
}

export class SimpleDIContainer implements DIContainer {
  private services = new Map<string | symbol, ServiceDescriptor>();

  register<T>(
    token: string | symbol,
    factory: (container: DIContainer) => T,
    lifetime: ServiceLifetime = "singleton",
  ): void {
    this.services.set(token, {
      token,
      factory,
      lifetime,
    });
  }

  resolve<T>(token: string | symbol): T {
    const descriptor = this.services.get(token);

    if (!descriptor) {
      throw new Error(`Service '${String(token)}' is not registered`);
    }

    switch (descriptor.lifetime) {
      case "singleton":
        if (!descriptor.instance) {
          descriptor.instance = descriptor.factory(this);
        }
        return descriptor.instance as T;

      case "transient":
        return descriptor.factory(this) as T;

      case "scoped":
        // For scoped services in root container, behave like singleton
        if (!descriptor.instance) {
          descriptor.instance = descriptor.factory(this);
        }
        return descriptor.instance as T;

      default:
        throw new Error(`Unknown service lifetime: ${descriptor.lifetime}`);
    }
  }

  isRegistered(token: string | symbol): boolean {
    return this.services.has(token);
  }

  clear(): void {
    this.services.clear();
  }

  createScope(): ScopedContainer {
    return new ScopedContainer(this);
  }
}

export class ScopedContainer implements DIContainer {
  private scopedInstances = new Map<string | symbol, any>();

  constructor(private parent: DIContainer) {}

  register<T>(
    token: string | symbol,
    factory: (container: DIContainer) => T,
    lifetime: ServiceLifetime = "scoped",
  ): void {
    // Delegate to parent for registration
    this.parent.register(token, factory, lifetime);
  }

  resolve<T>(token: string | symbol): T {
    if (!this.parent.isRegistered(token)) {
      throw new Error(`Service '${String(token)}' is not registered`);
    }

    // For scoped services, maintain instance within this scope
    const descriptor = (this.parent as any).services.get(token);

    if (descriptor?.lifetime === "scoped") {
      if (!this.scopedInstances.has(token)) {
        this.scopedInstances.set(token, descriptor.factory(this));
      }
      return this.scopedInstances.get(token) as T;
    }

    // Delegate to parent for singleton and transient services
    return this.parent.resolve<T>(token);
  }

  isRegistered(token: string | symbol): boolean {
    return this.parent.isRegistered(token);
  }

  clear(): void {
    this.scopedInstances.clear();
  }

  createScope(): ScopedContainer {
    return new ScopedContainer(this);
  }

  dispose(): void {
    this.scopedInstances.clear();
  }
}

// Global container instance
let globalContainer: DIContainer | null = null;

export function getContainer(): DIContainer {
  if (!globalContainer) {
    globalContainer = new SimpleDIContainer();
  }
  return globalContainer;
}

export function setContainer(container: DIContainer): void {
  globalContainer = container;
}

export function resetContainer(): void {
  globalContainer = null;
}

// Service tokens (symbols for type safety)
export const ServiceTokens = {
  // Vector Store Services
  OPENAI_VECTOR_STORE: Symbol("OPENAI_VECTOR_STORE"),
  NEON_VECTOR_STORE: Symbol("NEON_VECTOR_STORE"),
  MEMORY_VECTOR_STORE: Symbol("MEMORY_VECTOR_STORE"),
  UNIFIED_VECTOR_STORE: Symbol("UNIFIED_VECTOR_STORE"),

  // Agent Services
  QA_AGENT: Symbol("QA_AGENT"),
  REWRITE_AGENT: Symbol("REWRITE_AGENT"),
  PLANNER_AGENT: Symbol("PLANNER_AGENT"),
  RESEARCH_AGENT: Symbol("RESEARCH_AGENT"),
  AGENT_ORCHESTRATOR: Symbol("AGENT_ORCHESTRATOR"),
  AGENT_ROUTER: Symbol("AGENT_ROUTER"),

  // Monitoring Services
  VECTOR_STORE_MONITORING: Symbol("VECTOR_STORE_MONITORING"),
  PERFORMANCE_MONITOR: Symbol("PERFORMANCE_MONITOR"),

  // Cache Services
  CACHE_BACKEND: Symbol("CACHE_BACKEND"),
  SMART_CACHE: Symbol("SMART_CACHE"),
  VECTOR_STORE_CACHE: Symbol("VECTOR_STORE_CACHE"),

  // Database Services
  DATABASE_CLIENT: Symbol("DATABASE_CLIENT"),

  // Stream Services
  STREAM_CONTEXT: Symbol("STREAM_CONTEXT"),

  // Configuration
  CONFIG: Symbol("CONFIG"),
} as const;

// Helper functions for common patterns
export function registerSingleton<T>(
  token: string | symbol,
  factory: (container: DIContainer) => T,
): void {
  getContainer().register(token, factory, "singleton");
}

export function registerTransient<T>(
  token: string | symbol,
  factory: (container: DIContainer) => T,
): void {
  getContainer().register(token, factory, "transient");
}

export function registerScoped<T>(
  token: string | symbol,
  factory: (container: DIContainer) => T,
): void {
  getContainer().register(token, factory, "scoped");
}

export function resolve<T>(token: string | symbol): T {
  return getContainer().resolve<T>(token);
}

export function isRegistered(token: string | symbol): boolean {
  return getContainer().isRegistered(token);
}
