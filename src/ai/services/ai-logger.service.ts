import { Injectable } from '@nestjs/common';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

@Injectable()
export class AILoggerService {
  private readonly isDevelopment = process.env.NODE_ENV === 'development';
  private readonly logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;

  debug(message: string, context?: string, data?: any): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log('DEBUG', message, context, data);
    }
  }

  info(message: string, context?: string, data?: any): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log('INFO', message, context, data);
    }
  }

  warn(message: string, context?: string, data?: any): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log('WARN', message, context, data);
    }
  }

  error(message: string, context?: string, error?: Error, data?: any): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.log('ERROR', message, context, { error: error?.message, stack: error?.stack, ...data });
    }
  }

  private log(level: string, message: string, context?: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    
    console.log(`${timestamp} ${level} ${contextStr} ${message}${dataStr}`);
  }
}
