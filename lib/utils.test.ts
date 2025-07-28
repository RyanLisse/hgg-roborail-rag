import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Document } from "@/lib/db/schema";
import { ChatSDKError } from "./errors";
import {
  cn,
  fetcher,
  fetchWithErrorHandlers,
  generateUUID,
  getDocumentTimestampByIndex,
  getLocalStorage,
  getMostRecentUserMessage,
  getTrailingMessageId,
  sanitizeText,
} from "./utils";

// Mock fetch globally
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("cn", () => {
    it("should merge class names correctly", () => {
      const result = cn("text-red-500", "bg-blue-500");
      expect(result).toContain("text-red-500");
      expect(result).toContain("bg-blue-500");
    });

    it("should handle conditional classes", () => {
      const result = cn("base-class", { active: true, inactive: false });
      expect(result).toContain("base-class");
      expect(result).toContain("active");
      expect(result).not.toContain("inactive");
    });

    it("should handle empty inputs", () => {
      const result = cn();
      expect(result).toBe("");
    });
  });

  describe("fetcher", () => {
    it("should fetch and return JSON data successfully", async () => {
      const mockData = { message: "success" };
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
        mockResponse as Response,
      );

      const result = await fetcher("/test-url");

      expect(global.fetch).toHaveBeenCalledWith("/test-url");
      expect(result).toEqual(mockData);
    });

    it("should throw ChatSDKError on HTTP error", async () => {
      const mockErrorData = {
        code: "auth:invalid_api_key",
        cause: "Invalid key",
      };
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue(mockErrorData),
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
        mockResponse as Response,
      );

      await expect(fetcher("/test-url")).rejects.toThrow(ChatSDKError);
    });

    it("should handle network errors", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      await expect(fetcher("/test-url")).rejects.toThrow("Network error");
    });
  });

  describe("fetchWithErrorHandlers", () => {
    it("should return response on success", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: "test" }),
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
        mockResponse as Response,
      );

      const result = await fetchWithErrorHandlers("/test-url");

      expect(result).toBe(mockResponse);
    });

    it("should throw ChatSDKError on HTTP error", async () => {
      const mockErrorData = {
        code: "auth:rate_limit",
        cause: "Too many requests",
      };
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue(mockErrorData),
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
        mockResponse as Response,
      );

      await expect(fetchWithErrorHandlers("/test-url")).rejects.toThrow(
        ChatSDKError,
      );
    });

    it("should handle offline scenarios", async () => {
      // Mock navigator.onLine
      Object.defineProperty(global.navigator, "onLine", {
        value: false,
        writable: true,
      });

      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      await expect(fetchWithErrorHandlers("/test-url")).rejects.toThrow(
        ChatSDKError,
      );
    });

    it("should pass through other errors when online", async () => {
      Object.defineProperty(global.navigator, "onLine", {
        value: true,
        writable: true,
      });

      const customError = new Error("Custom error");
      (global.fetch as any).mockRejectedValue(customError);

      await expect(fetchWithErrorHandlers("/test-url")).rejects.toThrow(
        customError,
      );
    });
  });

  describe("getLocalStorage", () => {
    beforeEach(() => {
      localStorageMock.getItem.mockClear();
    });

    it("should return parsed data from localStorage", () => {
      const testData = ["item1", "item2"];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(testData));

      const result = getLocalStorage("test-key");

      expect(localStorageMock.getItem).toHaveBeenCalledWith("test-key");
      expect(result).toEqual(testData);
    });

    it("should return empty array when key not found", () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = getLocalStorage("missing-key");

      expect(result).toEqual([]);
    });

    it("should handle non-browser environment", () => {
      // Temporarily disable window
      const originalWindow = global.window;
      (global as any).window = undefined;

      const result = getLocalStorage("test-key");

      expect(result).toEqual([]);

      // Restore window
      global.window = originalWindow;
    });
  });

  describe("generateUUID", () => {
    it("should generate valid UUID format", () => {
      const uuid = generateUUID();

      // UUID v4 pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidPattern);
    });

    it("should generate unique UUIDs", () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();

      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe("getMostRecentUserMessage", () => {
    it("should return the last user message", () => {
      const messages: UIMessage[] = [
        { id: "1", role: "user", content: "First message" },
        { id: "2", role: "assistant", content: "Response" },
        { id: "3", role: "user", content: "Last user message" },
      ];

      const result = getMostRecentUserMessage(messages);

      expect(result).toEqual(messages[2]);
    });

    it("should return undefined when no user messages exist", () => {
      const messages: UIMessage[] = [
        { id: "1", role: "assistant", content: "Assistant message" },
        { id: "2", role: "system", content: "System message" },
      ];

      const result = getMostRecentUserMessage(messages);

      expect(result).toBeUndefined();
    });

    it("should return undefined for empty messages array", () => {
      const result = getMostRecentUserMessage([]);

      expect(result).toBeUndefined();
    });
  });

  describe("getDocumentTimestampByIndex", () => {
    it("should return document timestamp at index", () => {
      const testDate = new Date("2024-01-01");
      const documents: Document[] = [
        { id: "1", createdAt: testDate } as Document,
        { id: "2", createdAt: new Date("2024-01-02") } as Document,
      ];

      const result = getDocumentTimestampByIndex(documents, 0);

      expect(result).toBe(testDate);
    });

    it("should return new Date when index is out of bounds", () => {
      const documents: Document[] = [
        { id: "1", createdAt: new Date("2024-01-01") } as Document,
      ];

      const result = getDocumentTimestampByIndex(documents, 5);

      expect(result).toBeInstanceOf(Date);
    });

    it("should return new Date when documents is null/undefined", () => {
      const result = getDocumentTimestampByIndex(null as any, 0);

      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("getTrailingMessageId", () => {
    it("should return ID of last message", () => {
      const messages = [
        { id: "msg-1", role: "assistant", content: "First" },
        { id: "msg-2", role: "tool", content: "Tool response" },
      ];

      const result = getTrailingMessageId({ messages });

      expect(result).toBe("msg-2");
    });

    it("should return null for empty messages array", () => {
      const result = getTrailingMessageId({ messages: [] });

      expect(result).toBeNull();
    });
  });

  describe("sanitizeText", () => {
    it("should remove function call markers", () => {
      const text = "Hello <has_function_call>world";
      const result = sanitizeText(text);

      expect(result).toBe("Hello world");
    });

    it("should handle multiple occurrences", () => {
      const text = "<has_function_call>Start<has_function_call>End";
      const result = sanitizeText(text);

      expect(result).toBe("StartEnd");
    });

    it("should return unchanged text when no markers present", () => {
      const text = "Normal text without markers";
      const result = sanitizeText(text);

      expect(result).toBe(text);
    });

    it("should handle empty string", () => {
      const result = sanitizeText("");

      expect(result).toBe("");
    });
  });
});
