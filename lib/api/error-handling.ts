/**
 * Standardized API Error Handling
 *
 * This module provides a consistent error handling wrapper for all API routes,
 * eliminating repetitive error handling code and ensuring consistent error responses.
 *
 * Benefits:
 * - Reduces ~200 lines of duplicated error handling across 15+ routes
 * - Provides consistent error response format
 * - Centralizes authentication, validation, and rate limiting
 * - Improves maintainability and debugging
 */

import 'server-only';

import { auth } from '@/app/(auth)/auth';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { getMessageCountByUserId } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { z } from 'zod';
import type { NextRequest } from 'next/server';

/**
 * Standard API error response format
 */
interface ApiErrorResponse {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

/**
 * Configuration for API route wrapper
 */
interface ApiRouteConfig {
  requireAuth?: boolean;
  requireRateLimit?: boolean;
  maxDuration?: number;
  requestSchema?: z.ZodSchema<any>;
}

/**
 * API route handler type
 */
type ApiRouteHandler<T = any> = (
  request: NextRequest,
  context: {
    session?: any;
    params?: any;
    validatedBody?: T;
  },
) => Promise<Response>;

/**
 * Create a standardized error response
 */
function createErrorResponse(
  code: string,
  message: string,
  status = 500,
  details?: any,
): Response {
  const errorResponse: ApiErrorResponse = {
    code,
    message,
    timestamp: new Date().toISOString(),
    ...(details && { details }),
  };

  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Higher-order function that wraps API routes with standardized error handling
 */
export function withApiErrorHandling<T = any>(
  handler: ApiRouteHandler<T>,
  config: ApiRouteConfig = {},
) {
  const {
    requireAuth = true,
    requireRateLimit = false,
    requestSchema,
  } = config;

  return async (request: NextRequest, params?: any): Promise<Response> => {
    try {
      let session = null;
      let validatedBody = null;

      // Handle authentication if required
      if (requireAuth) {
        session = await auth();
        if (!session?.user) {
          return new ChatSDKError('unauthorized:chat').toResponse();
        }
      }

      // Handle rate limiting if required
      if (requireRateLimit && session?.user) {
        const messageCount = await getMessageCountByUserId({
          id: session.user.id,
          differenceInHours: 24,
        });

        const userType = session.user.type;
        if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
          return new ChatSDKError('rate_limit:chat').toResponse();
        }
      }

      // Handle request body validation if schema provided
      if (
        requestSchema &&
        (request.method === 'POST' ||
          request.method === 'PUT' ||
          request.method === 'PATCH')
      ) {
        try {
          const json = await request.json();
          validatedBody = requestSchema.parse(json);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return createErrorResponse(
              'bad_request:validation',
              'Invalid request parameters',
              400,
              error.errors,
            );
          }
          throw error;
        }
      }

      // Call the actual handler with context
      return await handler(request, {
        session,
        params,
        validatedBody,
      });
    } catch (error) {
      // Log the error for debugging
      console.error('API route error:', {
        url: request.url,
        method: request.method,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          'bad_request:validation',
          'Invalid request parameters',
          400,
          error.errors,
        );
      }

      // Handle ChatSDK errors (already have proper error responses)
      if (error instanceof ChatSDKError) {
        return error.toResponse();
      }

      // Handle generic errors
      return createErrorResponse(
        'internal_server_error:generic',
        'An unexpected error occurred while processing your request',
        500,
      );
    }
  };
}

/**
 * Wrapper specifically for streaming responses (like chat endpoints)
 */
export function withStreamingApiErrorHandling<T = any>(
  handler: ApiRouteHandler<T>,
  config: ApiRouteConfig = {},
) {
  return withApiErrorHandling(async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      // For streaming endpoints, we need to handle errors within the stream
      console.error('Streaming API error:', error);

      // Return a streaming error response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const errorData = JSON.stringify({
            type: 'error',
            error:
              error instanceof Error
                ? error.message
                : 'An error occurred while processing your request',
            timestamp: new Date().toISOString(),
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }
  }, config);
}

/**
 * Utility functions for common response patterns
 */
export const ApiResponses = {
  success: (data: any, status = 200) => Response.json(data, { status }),

  created: (data: any) => Response.json(data, { status: 201 }),

  noContent: () => new Response(null, { status: 204 }),

  badRequest: (message: string, details?: any) =>
    createErrorResponse('bad_request:generic', message, 400, details),

  unauthorized: (message = 'Authentication required') =>
    createErrorResponse('unauthorized:generic', message, 401),

  forbidden: (message = 'Access denied') =>
    createErrorResponse('forbidden:generic', message, 403),

  notFound: (message = 'Resource not found') =>
    createErrorResponse('not_found:generic', message, 404),

  conflict: (message: string, details?: any) =>
    createErrorResponse('conflict:generic', message, 409, details),

  tooManyRequests: (message = 'Rate limit exceeded') =>
    createErrorResponse('rate_limit:generic', message, 429),

  internalError: (message = 'Internal server error') =>
    createErrorResponse('internal_server_error:generic', message, 500),
} as const;

/**
 * Export types for use in route handlers
 */
export type { ApiRouteHandler, ApiRouteConfig, ApiErrorResponse };
