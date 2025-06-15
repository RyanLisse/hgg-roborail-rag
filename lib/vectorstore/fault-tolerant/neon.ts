// Placeholder file - fault tolerant implementation disabled due to complex type issues

export class FaultTolerantNeonVectorStoreService {
  constructor() {}
  
  async search(...args: any[]) {
    throw new Error('Fault tolerant services are disabled');
  }
}

export function createFaultTolerantNeonService(): FaultTolerantNeonVectorStoreService {
  return new FaultTolerantNeonVectorStoreService();
}