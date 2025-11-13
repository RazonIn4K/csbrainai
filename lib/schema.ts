import { z } from 'zod';

/**
 * Request validation schema for /api/answer
 * Enforces query constraints:
 * - Required string field
 * - Min 3 characters (after trim)
 * - Max 1000 characters
 */
export const AnswerRequestSchema = z.object({
  query: z
    .string({
      required_error: 'Query is required',
      invalid_type_error: 'Query must be a string',
    })
    .min(1, 'Query cannot be empty')
    .transform((s) => s.trim())
    .refine((s) => s.length >= 3, {
      message: 'Query must be at least 3 characters',
    })
    .refine((s) => s.length <= 1000, {
      message: 'Query must be at most 1000 characters',
    }),
});

export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;

/**
 * Citation structure in response
 */
export interface Citation {
  source_url: string;
  content: string;
  similarity: number;
}

/**
 * Success response from /api/answer
 */
export interface AnswerResponse {
  answer: string;
  citations: Citation[];
  q_hash: string;
  q_len: number;
  tokensUsed?: number;
}

/**
 * Error types for structured error handling
 */
export type ErrorType =
  | 'validation_error'
  | 'rate_limited'
  | 'internal_error'
  | 'service_unavailable';

/**
 * Structured error response
 * Allows clients to programmatically handle different error types
 */
export interface ErrorResponse {
  error: {
    type: ErrorType;
    message: string;
    field?: string;
    details?: any;
  };
  retryAfterSeconds?: number;
}

/**
 * Helper to create validation error response
 */
export function createValidationError(message: string, field?: string, details?: any): ErrorResponse {
  return {
    error: {
      type: 'validation_error',
      message,
      field,
      details,
    },
  };
}

/**
 * Helper to create rate limit error response
 */
export function createRateLimitError(retryAfterSeconds: number): ErrorResponse {
  return {
    error: {
      type: 'rate_limited',
      message: 'Too many requests. Please try again later.',
    },
    retryAfterSeconds,
  };
}

/**
 * Helper to create internal error response
 */
export function createInternalError(message?: string): ErrorResponse {
  return {
    error: {
      type: 'internal_error',
      message: message || 'Failed to generate answer. Please try again later.',
    },
  };
}

/**
 * Helper to create service unavailable error response
 */
export function createServiceUnavailableError(): ErrorResponse {
  return {
    error: {
      type: 'service_unavailable',
      message: 'Service temporarily unavailable. Please try again later.',
    },
  };
}
