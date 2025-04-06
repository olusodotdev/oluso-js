import { Cryer } from '../index';
import { CryerOptions } from '../types';
import { ExecutionContext, CallHandler, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

// Create a unified interceptor that handles both caught and uncaught errors
export function createCryerInterceptor(options: CryerOptions) {
  const cryer = new Cryer(options);
  
  @Injectable()
  class UnifiedCryerInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      // Get the HTTP context
      const httpContext = context.switchToHttp();
      const request = httpContext.getRequest();
      const response = httpContext.getResponse();
      
      // Initialize tracking flag
      const reportedErrorKey = '__cryerErrorReported';
      response[reportedErrorKey] = false;
      
      return next.handle().pipe(
        // Handle successful responses with error status codes
        tap(() => {
          if (response.statusCode >= 500 && !response[reportedErrorKey]) {
            const serverError = new Error(`Server error: ${response.statusCode}`);
            const errorWithMeta = serverError as any;
            errorWithMeta.severity = 'critical';
            errorWithMeta.path = request.path;
            errorWithMeta.method = request.method;
            
            cryer.reportError(errorWithMeta, request, response);
            response[reportedErrorKey] = true;
          }
        }),
        
        // Handle exceptions
        catchError(exception => {
          if (!response[reportedErrorKey]) {
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
              response[reportedErrorKey] = true;
            }
          }
          
          // Re-throw the exception to let NestJS handle the response
          throw exception;
        })
      );
    }
  }
  
  return UnifiedCryerInterceptor;
}

// Usage in your application
// const GlobalCryerInterceptor = createCryerInterceptor({
//   apiKey: process.env.CRYER_API_KEY,
//   environment: 'development',
//   tags: ['test-nest']
// });
// app.useGlobalInterceptors(new GlobalCryerInterceptor());