// Placeholder file - fault tolerant implementation disabled due to complex type issues

export class FaultTolerantUnifiedVectorStoreService {
  async search(..._args: any[]) {
    throw new Error('Fault tolerant services are disabled');
  }
}

export function createFaultTolerantUnifiedService(): FaultTolerantUnifiedVectorStoreService {
  return new FaultTolerantUnifiedVectorStoreService();
}
