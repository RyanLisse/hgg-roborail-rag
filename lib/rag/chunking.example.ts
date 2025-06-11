/**
 * Example usage of the Enhanced Document Chunking System
 * 
 * This file demonstrates how to use the enhanced chunking capabilities
 * for different types of documents and use cases.
 */

import { 
  createChunkingService, 
  chunkDocument,
  type Document,
} from './chunking';

import { 
  createRAGService,
  analyzeDocumentChunking,
  updateChunkingStrategy,
  getChunkingConfig
} from './rag';

// Example documents for testing different chunking strategies
const markdownDocument: Document = {
  id: 'markdown-guide',
  content: `
# Enhanced Document Chunking Guide

This guide explains how to use the enhanced document chunking system for optimal RAG performance.

## Overview

The enhanced chunking system provides multiple strategies for breaking down documents into meaningful chunks that preserve semantic boundaries and document structure.

### Key Features

- **Semantic Chunking**: Respects document structure
- **Quality Validation**: Ensures chunk completeness
- **Multiple Strategies**: Character, semantic, recursive, and hybrid approaches

## Implementation

Here's how to implement enhanced chunking in your application:

\`\`\`typescript
import { createChunkingService } from './chunking';

const service = createChunkingService({
  strategy: 'hybrid',
  chunkSize: 1500,
  preserveStructure: true
});
\`\`\`

### Configuration Options

The system supports various configuration options:

1. **Strategy Selection**: Choose the appropriate chunking strategy
2. **Size Control**: Set minimum and maximum chunk sizes
3. **Quality Control**: Enable validation for better results

## Best Practices

When using the enhanced chunking system:

- Use hybrid strategy for mixed content
- Enable quality validation for better retrieval
- Adjust chunk sizes based on your embedding model
- Consider document type when selecting strategies

## Conclusion

Enhanced chunking significantly improves RAG performance by creating more semantically meaningful chunks while preserving document structure.
  `.trim(),
  type: 'markdown',
  metadata: {
    title: 'Enhanced Document Chunking Guide',
    author: 'AI Assistant',
    category: 'documentation',
    tags: ['chunking', 'rag', 'nlp']
  }
};

const codeDocument: Document = {
  id: 'typescript-example',
  content: `
// Enhanced chunking service implementation
import { z } from 'zod';

interface ChunkingConfig {
  strategy: 'character' | 'semantic' | 'recursive' | 'hybrid';
  chunkSize: number;
  chunkOverlap: number;
  preserveStructure: boolean;
}

class DocumentChunkingService {
  private config: ChunkingConfig;

  constructor(config: ChunkingConfig) {
    this.config = config;
  }

  async chunkDocument(document: Document): Promise<ChunkingResult> {
    const chunks = this.applyChunkingStrategy(document);
    const qualityMetrics = this.validateChunks(chunks);
    
    return {
      chunks,
      strategy: this.config.strategy,
      qualityMetrics
    };
  }

  private applyChunkingStrategy(document: Document): string[] {
    switch (this.config.strategy) {
      case 'semantic':
        return this.semanticChunk(document);
      case 'recursive':
        return this.recursiveChunk(document);
      case 'hybrid':
        return this.hybridChunk(document);
      default:
        return this.characterChunk(document);
    }
  }

  private validateChunks(chunks: string[]): QualityMetrics {
    // Quality validation logic
    return {
      avgQualityScore: 0.85,
      structurePreservation: 0.9,
      boundaryCoverage: 0.95
    };
  }
}

export { DocumentChunkingService };
  `.trim(),
  type: 'code',
  metadata: {
    title: 'TypeScript Chunking Implementation',
    language: 'typescript',
    category: 'source-code'
  }
};

const plainTextDocument: Document = {
  id: 'research-paper',
  content: `
Artificial Intelligence has transformed the way we process and understand textual information. Recent advances in natural language processing have enabled the development of sophisticated systems that can analyze, summarize, and generate human-like text. 

One critical aspect of these systems is document chunking, which involves breaking down large documents into smaller, manageable pieces while preserving semantic meaning. Traditional chunking methods often rely on simple character or word counts, but this approach can lead to chunks that split important concepts across boundaries.

Enhanced chunking strategies address these limitations by considering document structure, semantic boundaries, and content quality. These methods use advanced algorithms to identify natural break points in text, such as paragraph boundaries, section headers, and topic transitions.

The benefits of enhanced chunking include improved retrieval accuracy in RAG systems, better preservation of document context, and more meaningful representations for embedding models. Research has shown that structure-aware chunking can improve retrieval performance by up to 25% compared to naive character-based approaches.

Furthermore, quality validation mechanisms ensure that each chunk maintains coherence and completeness. This is particularly important for technical documents, research papers, and other content where maintaining the integrity of ideas is crucial for accurate information retrieval.
  `.trim(),
  type: 'text',
  metadata: {
    title: 'Enhanced Document Chunking Research',
    category: 'research',
    domain: 'artificial-intelligence'
  }
};

/**
 * Example 1: Basic chunking service usage
 */
export async function basicChunkingExample() {
  console.log('=== Basic Chunking Example ===');
  
  // Create a chunking service with default configuration
  const chunkingService = createChunkingService({
    strategy: 'hybrid',
    chunkSize: 800,
    chunkOverlap: 100,
    preserveStructure: true,
    enableQualityValidation: true
  });

  // Chunk the markdown document
  const result = await chunkingService.chunkDocument(markdownDocument);
  
  console.log(`Strategy: ${result.strategy}`);
  console.log(`Number of chunks: ${result.chunks.length}`);
  console.log(`Average chunk size: ${Math.round(result.avgChunkSize)} characters`);
  console.log(`Quality metrics:`, result.qualityMetrics);
  
  // Show first chunk with metadata
  if (result.chunks.length > 0) {
    const firstChunk = result.chunks[0];
    console.log('\nFirst chunk:');
    console.log('Content preview:', `${firstChunk.content.substring(0, 200)}...`);
    console.log('Metadata:', {
      chunkType: firstChunk.metadata.chunkType,
      qualityScore: firstChunk.metadata.quality?.score,
      preservedStructure: firstChunk.boundaries.preservedStructure
    });
  }
}

/**
 * Example 2: Strategy comparison
 */
export async function strategyComparisonExample() {
  console.log('\n=== Strategy Comparison Example ===');
  
  const strategies: Array<'character' | 'semantic' | 'recursive' | 'hybrid'> = [
    'character', 'semantic', 'recursive', 'hybrid'
  ];

  for (const strategy of strategies) {
    const service = createChunkingService({
      strategy,
      chunkSize: 1000,
      enableQualityValidation: true
    });

    const result = await service.chunkDocument(codeDocument);
    
    console.log(`\n${strategy.toUpperCase()} Strategy:`);
    console.log(`  Chunks: ${result.chunks.length}`);
    console.log(`  Avg Size: ${Math.round(result.avgChunkSize)}`);
    console.log(`  Quality: ${result.qualityMetrics.avgQualityScore.toFixed(2)}`);
    console.log(`  Structure: ${result.qualityMetrics.structurePreservation.toFixed(2)}`);
  }
}

/**
 * Example 3: RAG integration with enhanced chunking
 */
export async function ragIntegrationExample() {
  console.log('\n=== RAG Integration Example ===');
  
  // Create RAG service with enhanced chunking
  const ragService = createRAGService({
    vectorStore: 'memory',
    embeddingModel: 'openai-text-embedding-3-small',
    chatModel: 'openai-gpt-4o',
    chunking: {
      strategy: 'hybrid',
      preserveStructure: true,
      enableQualityValidation: true,
      minChunkSize: 200,
      maxChunkSize: 1500,
    }
  });

  console.log('RAG chunking configuration:', getChunkingConfig(ragService));

  // Analyze document chunking without embedding
  const analysis = await analyzeDocumentChunking(ragService, plainTextDocument);
  console.log('\nDocument analysis:');
  console.log(`  Strategy: ${analysis.strategy}`);
  console.log(`  Total chunks: ${analysis.chunks.length}`);
  console.log(`  Avg quality: ${analysis.qualityMetrics.avgQualityScore.toFixed(2)}`);
  console.log(`  Token estimate: ${analysis.totalTokens}`);

  // Update strategy and re-analyze
  updateChunkingStrategy(ragService, 'semantic');
  const semanticAnalysis = await analyzeDocumentChunking(ragService, plainTextDocument);
  
  console.log('\nAfter switching to semantic strategy:');
  console.log(`  Chunks: ${semanticAnalysis.chunks.length}`);
  console.log(`  Quality: ${semanticAnalysis.qualityMetrics.avgQualityScore.toFixed(2)}`);
}

/**
 * Example 4: Document type specific chunking
 */
export async function documentTypeExample() {
  console.log('\n=== Document Type Specific Example ===');
  
  const documents = [
    { name: 'Markdown', doc: markdownDocument, strategy: 'markdown' as const },
    { name: 'Code', doc: codeDocument, strategy: 'code' as const },
    { name: 'Plain Text', doc: plainTextDocument, strategy: 'semantic' as const }
  ];

  for (const { name, doc, strategy } of documents) {
    const result = await chunkDocument(doc, {
      strategy,
      chunkSize: 1200,
      preserveStructure: true,
      enableQualityValidation: true
    });

    console.log(`\n${name} Document (${strategy} strategy):`);
    console.log(`  Chunks: ${result.chunks.length}`);
    console.log(`  Quality: ${result.qualityMetrics.avgQualityScore.toFixed(2)}`);
    
    // Show chunk types distribution
    const chunkTypes = result.chunks.map(c => c.metadata.chunkType).filter(Boolean);
    const typeDistribution = chunkTypes.reduce((acc, type) => {
      acc[type!] = (acc[type!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    if (Object.keys(typeDistribution).length > 0) {
      console.log(`  Chunk types:`, typeDistribution);
    }
  }
}

/**
 * Example 5: Quality validation insights
 */
export async function qualityValidationExample() {
  console.log('\n=== Quality Validation Example ===');
  
  const service = createChunkingService({
    strategy: 'hybrid',
    chunkSize: 600,
    enableQualityValidation: true
  });

  const result = await service.chunkDocument(markdownDocument);
  
  console.log('Quality analysis by chunk:');
  result.chunks.forEach((chunk, index) => {
    const quality = chunk.metadata.quality;
    if (quality) {
      console.log(`  Chunk ${index + 1}:`);
      console.log(`    Overall: ${quality.score.toFixed(2)}`);
      console.log(`    Completeness: ${quality.completeness.toFixed(2)}`);
      console.log(`    Coherence: ${quality.coherence.toFixed(2)}`);
      console.log(`    Type: ${chunk.metadata.chunkType || 'unknown'}`);
    }
  });

  // Identify best and worst quality chunks
  const qualityScores = result.chunks
    .map((chunk, index) => ({ index, score: chunk.metadata.quality?.score || 0 }))
    .sort((a, b) => b.score - a.score);

  console.log(`\nBest quality chunk (#${qualityScores[0].index + 1}): ${qualityScores[0].score.toFixed(2)}`);
  console.log(`Worst quality chunk (#${qualityScores[qualityScores.length - 1].index + 1}): ${qualityScores[qualityScores.length - 1].score.toFixed(2)}`);
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    await basicChunkingExample();
    await strategyComparisonExample();
    await ragIntegrationExample();
    await documentTypeExample();
    await qualityValidationExample();
    
    console.log('\n=== All Examples Completed Successfully ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export the example functions for use in other parts of the application
export {
  markdownDocument,
  codeDocument,
  plainTextDocument
};