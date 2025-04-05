import { CryerOptions, ErrorReport } from './types';
import { sendErrorReport } from './utils/https';

export * from './types';
export * from './adapters/express';
export * from './adapters/nest';

export class Cryer {
  private options: CryerOptions;
  private reportUrl = 'https://crier-test.onrender.com/api/v1/error/report';
  
  constructor(options: CryerOptions) {
    // Set default options
    this.options = {
      logToConsole: true,
      timeout: 5000,
      environment:'development',
      defaultSeverity: 'medium',
      ...options
    };
    
    // Register global uncaught exception handler
    this.registerGlobalHandlers();
  }
  
  private registerGlobalHandlers() {
    process.on('uncaughtException', (error) => {
      this.reportError(error);
    });
    
    process.on('unhandledRejection', (reason) => {
      if (reason instanceof Error) {
        this.reportError(reason);
      } else {
        this.reportError(new Error(`Unhandled rejection: ${String(reason)}`));
      }
    });
  }
  
  public reportError(error: Error, req?: any, res?: any): Promise<void> {
    // Check if we should report this error
    if (this.options.shouldReport && !this.options.shouldReport(error, req, res)) {
      return Promise.resolve();
    }
    
    // Log to console if enabled
    if (this.options.logToConsole) {
      console.error('[Cryer]', error);
    }
    
    // Extract a short title from the error message
    const title = this.generateErrorTitle(error);
    
    // Prepare error report
    const report: ErrorReport = {
      title: title,
      message: error.message,
      stack_trace: error.stack,
      environment: this.options.environment,
      severity: this.extractSeverity(error, res),
      tags: this.generateTags(error, req)
    };
    
    // Send the report
    return sendErrorReport(this.reportUrl, report, {
      apiKey: this.options.apiKey,
      timeout: this.options.timeout
    });
  }
  
  private generateErrorTitle(error: Error): string {
    // Extract the first line of the error message or use the constructor name
    const firstLine = error.message.split('\n')[0].trim();
    if (firstLine && firstLine.length > 0) {
      // Limit title length
      return firstLine.length <= 100 ? firstLine : `${firstLine.substring(0, 97)}...`;
    }
    return `${error.constructor.name} Error`;
  }
  
  private extractSeverity(error: Error, res?: any): string {
    // Check if severity is explicitly set on the error
    if ((error as any).severity) {
      return (error as any).severity;
    }
    
    // Determine severity based on status code if available
    if (res && res.statusCode) {
      if (res.statusCode >= 500) return 'critical';
      if (res.statusCode >= 400) return 'high';
    }
    
    // Use default severity
    return this.options.defaultSeverity || 'medium';
  }
  
  private generateTags(error: Error, req?: any): string[] {
    const tags = [...(this.options.tags || [])];
    
    // Add error type as tag
    tags.push(error.constructor.name);
    
    // Add route as tag if available
    if (req && req.route && req.route.path) {
      tags.push(`route:${req.route.path}`);
    }
    
    // Add HTTP method as tag if available
    if (req && req.method) {
      tags.push(`method:${req.method.toLowerCase()}`);
    }
    
    // Extract status code tag if available
    if (req && req.res && req.res.statusCode) {
      tags.push(`status:${req.res.statusCode}`);
    }
    
    return tags;
  }
}