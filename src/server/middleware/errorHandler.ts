/**
 * Centralized API Error Boundary Middleware
 * DV-Assistance Platform - Step 10
 *
 * Catches unhandled errors within the /api/* route hierarchy.
 * Formats errors into a consistent machine-readable payload containing the request correlation ID.
 * Strictly prevents the leakage of stack traces, internal file paths, or secrets in production.
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { config } from '../config.ts';

export interface ApiErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
    readonly details?: unknown;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiErrorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If response headers have already been transmitted, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const requestId = req.requestId || 'unknown-request-id';

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal error occurred.';
  let details: unknown = undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    // Malformed JSON request body
    statusCode = 400;
    errorCode = 'INVALID_JSON_PAYLOAD';
    message = 'Request payload is not valid JSON.';
  } else if (err instanceof Error) {
    // Standard unhandled error: only expose message in development
    if (config.isDev) {
      message = err.message;
      details = { stack: err.stack };
    }
  }

  // Safe development logging without sensitive payload logging
  if (config.isDev && statusCode >= 500) {
    console.error(`[ApiError] [${requestId}] ${statusCode} ${errorCode}:`, err);
  }

  const responsePayload: ApiErrorResponse = {
    error: {
      code: errorCode,
      message,
      requestId,
      ...(config.isDev && details ? { details } : {}),
    },
  };

  res.status(statusCode).json(responsePayload);
};

export default apiErrorHandler;
