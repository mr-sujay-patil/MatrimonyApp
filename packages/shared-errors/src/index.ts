export class ApplicationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details: any[] = []
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: new Date().toISOString()
      }
    };
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(code, message, 404);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string = 'Validation failed', details: any[] = [], code: string = 'VALIDATION_FAILED') {
    super(code, message, 400, details);
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED') {
    super(code, message, 401);
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message: string = 'Forbidden', code: string = 'FORBIDDEN') {
    super(code, message, 403);
  }
}
