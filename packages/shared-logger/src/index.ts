export interface LogMetadata {
  correlationId?: string;
  [key: string]: any;
}

export class Logger {
  constructor(private readonly serviceName: string) {}

  private formatMessage(level: string, message: string, meta?: LogMetadata) {
    const logObject = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      correlationId: meta?.correlationId || 'N/A',
      metadata: this.maskPii(meta || {})
    };
    return JSON.stringify(logObject);
  }

  private maskPii(meta: Record<string, any>): Record<string, any> {
    const masked = { ...meta };
    const piiKeys = ['email', 'phone', 'phoneNumber', 'password', 'token', 'annualIncome'];
    for (const key of Object.keys(masked)) {
      if (piiKeys.includes(key) && typeof masked[key] === 'string') {
        masked[key] = '***MASKED***';
      } else if (typeof masked[key] === 'object' && masked[key] !== null) {
        masked[key] = this.maskPii(masked[key]);
      }
    }
    return masked;
  }

  info(message: string, meta?: LogMetadata) {
    console.log(this.formatMessage('INFO', message, meta));
  }

  warn(message: string, meta?: LogMetadata) {
    console.warn(this.formatMessage('WARN', message, meta));
  }

  error(message: string, error?: Error, meta?: LogMetadata) {
    const errorMeta = {
      ...meta,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack
    };
    console.error(this.formatMessage('ERROR', message, errorMeta));
  }
}
