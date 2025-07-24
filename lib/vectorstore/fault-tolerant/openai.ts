// Placeholder file - fault tolerant implementation disabled due to complex type issues

export class FaultTolerantOpenAIVectorStoreService {
  async search(..._args: any[]) {
    throw new Error('Fault tolerant services are disabled');
  }
}

export function createFaultTolerantOpenAIService(): FaultTolerantOpenAIVectorStoreService {
  return new FaultTolerantOpenAIVectorStoreService();
}
