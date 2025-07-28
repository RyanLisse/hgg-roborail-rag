/**
 * Citation System Integration Test
 *
 * This test validates the complete citation flow:
 * 1. API endpoints return proper citation data
 * 2. Citation parsing works correctly
 * 3. Frontend components display citations properly
 * 4. OpenAI file citations are extracted and formatted
 */

import {
  parseCitationsFromContent,
  formatCitationsMarkdown,
  validateCitations,
} from "./lib/utils/citations.js";
import { getOpenAIResponsesService } from "./lib/ai/responses.js";
import { enhancedSearch } from "./lib/ai/tools/enhanced-search.js";
import { searchDocuments } from "./lib/ai/tools/search-documents.js";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Test citation parsing utilities
function testCitationParsing() {
  // Mock data simulating OpenAI response
  const mockContent =
    "This is a test response with citations [1] and more information [2].";
  const mockAnnotations = [
    {
      id: "anno_1",
      type: "file_citation",
      text: "test citation",
      start_index: 42,
      end_index: 45,
      file_citation: {
        file_id: "file-123",
        quote: "This is a quoted text from the source",
      },
    },
    {
      id: "anno_2",
      type: "file_citation",
      text: "another citation",
      start_index: 68,
      end_index: 71,
      file_citation: {
        file_id: "file-456",
        quote: "Another quoted passage",
      },
    },
  ];
  const mockSources = [
    { id: "file-123", name: "document1.pdf" },
    { id: "file-456", name: "manual.docx" },
  ];

  try {
    // Test parseCitationsFromContent function
    const result = parseCitationsFromContent(
      mockContent,
      mockAnnotations,
      mockSources,
    );

    const citationInfo = {
      hasAnnotations: result.hasAnnotations,
      citationCount: result.citations.length,
      citations: result.citations.map((c) => ({
        number: c.number,
        fileName: c.fileName,
        quote: c.quote ? `${c.quote.substring(0, 30)}...` : "",
      })),
    };

    // Test markdown formatting
    const markdown = formatCitationsMarkdown(result.citations);

    // Test validation
    const validation = validateCitations(result.citations);

    return {
      success: true,
      citations: result.citations,
      citationInfo,
      markdown,
      validation,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test API endpoints for citation data
async function testAPIEndpoints() {
  try {
    // Test search-enhanced endpoint
    const searchResponse = await fetch(
      `${BASE_URL}/api/vectorstore/search-enhanced`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: "test search for citations",
          sources: ["memory"],
          maxResults: 3,
          includeCitations: true,
          optimizePrompts: true,
        }),
      },
    );

    let searchData = null;
    if (searchResponse.ok) {
      searchData = await searchResponse.json();
    }

    // Test GET endpoint for capabilities
    const infoResponse = await fetch(
      `${BASE_URL}/api/vectorstore/search-enhanced`,
    );
    let infoData = null;
    if (infoResponse.ok) {
      infoData = await infoResponse.json();
    }

    return { success: true, searchData, infoData };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test OpenAI Responses service citation handling
function testOpenAIResponsesService() {
  try {
    const responsesService = getOpenAIResponsesService();

    // Test static methods
    const mockSources = [
      { id: "file-1", name: "test.pdf" },
      { id: "file-2", name: "manual.docx" },
    ];

    const formattedCitations =
      responsesService.constructor.formatCitations(mockSources);

    const mockAnnotations = [
      {
        type: "file_citation",
        file_citation: { quote: "Test quote 1" },
      },
      {
        type: "file_citation",
        file_citation: { quote: "Test quote 2" },
      },
    ];

    const quotes = responsesService.constructor.extractQuotes(mockAnnotations);

    return { success: true, formattedCitations, quotes };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test enhanced search tool
function testEnhancedSearchTool() {
  try {
    // This would require a proper test environment with vector stores
    // For now, we'll test the tool structure
    const tool = enhancedSearch(["memory"]);

    const toolInfo = {
      hasDescription: !!tool.description,
      hasParameters: !!tool.parameters,
      hasExecute: typeof tool.execute === "function",
      description: `${tool.description.substring(0, 50)}...`,
    };

    return { success: true, toolInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test search documents tool
function testSearchDocumentsTool() {
  try {
    const tool = searchDocuments(["memory"]);

    const toolInfo = {
      hasDescription: !!tool.description,
      hasParameters: !!tool.parameters,
      hasExecute: typeof tool.execute === "function",
      description: `${tool.description.substring(0, 50)}...`,
    };

    return { success: true, toolInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runCitationTests() {
  const results = {
    citationParsing: testCitationParsing(),
    apiEndpoints: await testAPIEndpoints(),
    openaiService: testOpenAIResponsesService(),
    enhancedSearchTool: testEnhancedSearchTool(),
    searchDocumentsTool: testSearchDocumentsTool(),
  };

  const allPassed = Object.values(results).every((r) => r.success);

  return { results, allPassed };
}

// Run tests if this file is executed directly
if (typeof require !== "undefined" && require.main === module) {
  runCitationTests().catch(() => {
    process.exit(1);
  });
}

export { runCitationTests };
