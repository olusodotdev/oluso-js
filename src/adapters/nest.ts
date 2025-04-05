import { Cryer } from '../index';
import { CryerOptions } from '../types';

// Type definitions for NestJS
interface ArgumentsHost {
  switchToHttp(): {
    getRequest(): any;
    getResponse(): any;
  };
}

interface ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void;
}

export function CryerExceptionFilter(options: CryerOptions): new () => ExceptionFilter {
  const cryer = new Cryer(options);
  
  return class implements ExceptionFilter {
    catch(exception: Error, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const request = ctx.getRequest();
      const response = ctx.getResponse();
      
      // Extract status code from the exception if available
      const status = (exception as any).status || (exception as any).statusCode || 500;
      
      // Determine severity based on status code
      let severity: 'critical' | 'high' | 'medium' | 'low' = options.defaultSeverity || 'medium';
      if (status >= 500) {
        severity = 'critical';
      } else if (status >= 400) {
        severity = 'high';
      }
      
      // Add severity to the exception
      (exception as any).severity = severity;
      
      // Only report server errors (500) or if specifically configured
      if (status >= 500 || (options.shouldReport && options.shouldReport(exception, request, response))) {
        cryer.reportError(exception, request, response);
      }
    }
  };
}