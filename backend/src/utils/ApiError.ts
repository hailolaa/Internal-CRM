export interface ApiErrorDetail {
  field: string;
  message: string;
  location?: string;
  value?: unknown;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, isOperational = true, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.name = "ApiError";

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  // --- Factory methods for common errors ---

  static badRequest(message = "Bad request", details?: unknown) {
    return new ApiError(400, message, true, details);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflict", details?: unknown) {
    return new ApiError(409, message, true, details);
  }

  static tooManyRequests(message = "Too many requests") {
    return new ApiError(429, message);
  }

  static serviceUnavailable(message = "Service unavailable", details?: unknown) {
    return new ApiError(503, message, true, details);
  }

  static notImplemented(message = "Not implemented", details?: unknown) {
    return new ApiError(501, message, true, details);
  }

  static internal(message = "Internal server error") {
    return new ApiError(500, message, false);
  }
}
