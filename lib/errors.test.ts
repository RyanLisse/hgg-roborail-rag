import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ChatSDKError,
  type ErrorCode,
  type ErrorType,
  getMessageByErrorCode,
  type Surface,
  visibilityBySurface,
} from "./errors";

// Mock console.error for testing
const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

describe("Errors", () => {
  beforeEach(() => {
    consoleSpy.mockClear();
  });

  describe("ChatSDKError", () => {
    it("should create error with correct properties", () => {
      const error = new ChatSDKError("rate_limit:chat", "Too many requests");

      expect(error.type).toBe("rate_limit");
      expect(error.surface).toBe("chat");
      expect(error.cause).toBe("Too many requests");
      expect(error.statusCode).toBe(429);
      expect(error.message).toBe(
        "You have exceeded your maximum number of messages for the day. Please try again later.",
      );
    });

    it("should parse error code correctly", () => {
      const error = new ChatSDKError("unauthorized:auth");

      expect(error.type).toBe("unauthorized");
      expect(error.surface).toBe("auth");
      expect(error.statusCode).toBe(401);
    });

    it("should support retry configuration", () => {
      const error = new ChatSDKError(
        "network:vectorstore",
        "Network timeout",
        true,
        5000,
      );

      expect(error.retryable).toBe(true);
      expect(error.suggestedDelay).toBe(5000);
    });

    describe("fromVectorStoreError", () => {
      it("should map vector store errors correctly", () => {
        const vectorStoreError = {
          type: "network",
          message: "Connection failed",
          retryable: true,
          suggestedDelay: 1000,
        };

        const chatError = ChatSDKError.fromVectorStoreError(vectorStoreError);

        expect(chatError.type).toBe("network");
        expect(chatError.surface).toBe("vectorstore");
        expect(chatError.cause).toBe("Connection failed");
        expect(chatError.retryable).toBe(true);
        expect(chatError.suggestedDelay).toBe(1000);
      });

      it("should map unknown error types to unknown", () => {
        const vectorStoreError = {
          type: "custom_error",
          message: "Custom error message",
        };

        const chatError = ChatSDKError.fromVectorStoreError(vectorStoreError);

        expect(chatError.type).toBe("unknown");
        expect(chatError.surface).toBe("vectorstore");
      });

      it("should support custom surface", () => {
        const vectorStoreError = {
          type: "authentication",
          message: "Auth failed",
        };

        const chatError = ChatSDKError.fromVectorStoreError(
          vectorStoreError,
          "agent",
        );

        expect(chatError.type).toBe("authentication");
        expect(chatError.surface).toBe("agent");
      });
    });

    describe("toResponse", () => {
      it("should return full error details for response visibility", () => {
        const error = new ChatSDKError("unauthorized:auth", "Invalid token");

        const response = error.toResponse();

        expect(response.status).toBe(401);
        // Check response body
        return response.json().then((body) => {
          expect(body.code).toBe("unauthorized:auth");
          expect(body.message).toBe("You need to sign in before continuing.");
          expect(body.cause).toBe("Invalid token");
        });
      });

      it("should log error and return generic message for log visibility", () => {
        const error = new ChatSDKError("unknown:database", "SQL error");

        const response = error.toResponse();

        expect(response.status).toBe(500);
        expect(consoleSpy).toHaveBeenCalledWith({
          code: "unknown:database",
          message: "An error occurred while executing a database query.",
          cause: "SQL error",
        });

        return response.json().then((body) => {
          expect(body.code).toBe("");
          expect(body.message).toBe(
            "Something went wrong. Please try again later.",
          );
        });
      });
    });
  });

  describe("getMessageByErrorCode", () => {
    it("should return database error message for database errors", () => {
      const message = getMessageByErrorCode("unknown:database");
      expect(message).toBe(
        "An error occurred while executing a database query.",
      );
    });

    it("should return specific messages for auth errors", () => {
      expect(getMessageByErrorCode("unauthorized:auth")).toBe(
        "You need to sign in before continuing.",
      );
      expect(getMessageByErrorCode("forbidden:auth")).toBe(
        "Your account does not have access to this feature.",
      );
    });

    it("should return specific messages for chat errors", () => {
      expect(getMessageByErrorCode("rate_limit:chat")).toBe(
        "You have exceeded your maximum number of messages for the day. Please try again later.",
      );
      expect(getMessageByErrorCode("not_found:chat")).toBe(
        "The requested chat was not found. Please check the chat ID and try again.",
      );
      expect(getMessageByErrorCode("offline:chat")).toBe(
        "We're having trouble sending your message. Please check your internet connection and try again.",
      );
    });

    it("should return specific messages for document errors", () => {
      expect(getMessageByErrorCode("not_found:document")).toBe(
        "The requested document was not found. Please check the document ID and try again.",
      );
      expect(getMessageByErrorCode("forbidden:document")).toBe(
        "This document belongs to another user. Please check the document ID and try again.",
      );
    });

    it("should return specific messages for vectorstore errors", () => {
      expect(getMessageByErrorCode("network:vectorstore")).toBe(
        "Network connection to vector store failed. Please check your internet connection and try again.",
      );
      expect(getMessageByErrorCode("authentication:vectorstore")).toBe(
        "Vector store authentication failed. Please check your API configuration.",
      );
      expect(getMessageByErrorCode("rate_limit:vectorstore")).toBe(
        "Vector store rate limit exceeded. Please wait and try again.",
      );
    });

    it("should return specific messages for agent errors", () => {
      expect(getMessageByErrorCode("network:agent")).toBe(
        "Agent service network error. Please check your connection and try again.",
      );
      expect(getMessageByErrorCode("authentication:agent")).toBe(
        "Agent service authentication failed. Please check your configuration.",
      );
    });

    it("should return default message for unknown error codes", () => {
      const message = getMessageByErrorCode("unknown:unknown" as ErrorCode);
      expect(message).toBe("Something went wrong. Please try again later.");
    });
  });

  describe("visibilityBySurface", () => {
    it("should define visibility for all surfaces", () => {
      const surfaces: Surface[] = [
        "chat",
        "auth",
        "api",
        "stream",
        "database",
        "history",
        "vote",
        "document",
        "suggestions",
        "vectorstore",
        "agent",
      ];

      surfaces.forEach((surface) => {
        expect(visibilityBySurface[surface]).toBeDefined();
        expect(["response", "log", "none"]).toContain(
          visibilityBySurface[surface],
        );
      });
    });

    it("should set database and vectorstore errors to log visibility", () => {
      expect(visibilityBySurface.database).toBe("log");
      expect(visibilityBySurface.vectorstore).toBe("log");
    });

    it("should set user-facing surfaces to response visibility", () => {
      const userFacingSurfaces: Surface[] = [
        "chat",
        "auth",
        "api",
        "stream",
        "history",
        "vote",
        "document",
        "suggestions",
        "agent",
      ];

      userFacingSurfaces.forEach((surface) => {
        expect(visibilityBySurface[surface]).toBe("response");
      });
    });
  });

  describe("Error Type to Status Code Mapping", () => {
    const testCases: Array<[ErrorType, number]> = [
      ["bad_request", 400],
      ["validation", 400],
      ["unauthorized", 401],
      ["authentication", 401],
      ["forbidden", 403],
      ["not_found", 404],
      ["rate_limit", 429],
      ["offline", 503],
      ["service_unavailable", 503],
      ["network", 502],
      ["unknown", 500],
    ];

    testCases.forEach(([errorType, expectedStatus]) => {
      it(`should map ${errorType} to status ${expectedStatus}`, () => {
        const error = new ChatSDKError(`${errorType}:chat` as ErrorCode);
        expect(error.statusCode).toBe(expectedStatus);
      });
    });
  });

  describe("Error Code Validation", () => {
    it("should handle properly formatted error codes", () => {
      const validCodes: ErrorCode[] = [
        "bad_request:api",
        "unauthorized:auth",
        "network:vectorstore",
        "validation:agent",
      ];

      validCodes.forEach((code) => {
        const error = new ChatSDKError(code);
        expect(error.type).toBeDefined();
        expect(error.surface).toBeDefined();
        expect(error.statusCode).toBeGreaterThan(0);
      });
    });

    it("should handle error codes with unexpected format gracefully", () => {
      // This tests robustness - the constructor should not crash
      const error = new ChatSDKError("invalid-format" as ErrorCode);

      expect(error.type).toBe("invalid-format");
      expect(error.surface).toBeUndefined();
      expect(error.statusCode).toBe(500); // defaults to 500 for unknown types
    });
  });

  describe("Error Message Consistency", () => {
    it("should provide helpful user-facing messages", () => {
      const userFacingCodes: ErrorCode[] = [
        "unauthorized:auth",
        "rate_limit:chat",
        "not_found:document",
        "offline:chat",
      ];

      userFacingCodes.forEach((code) => {
        const message = getMessageByErrorCode(code);
        expect(message.length).toBeGreaterThan(10);
        expect(message).not.toMatch(/error/i); // Should avoid technical jargon
        expect(message).toMatch(/try again|sign in|check/i); // Should provide guidance
      });
    });
  });
});
