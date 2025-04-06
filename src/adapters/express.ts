import { Cryer } from '../index';
import { CryerOptions } from '../types';
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

// Create a middleware factory function that returns both regular and error handler middleware
export function cryerExpress(options: CryerOptions): {
  errorHandler: ErrorRequestHandler;
  middleware: (req: Request, res: Response, next: NextFunction) => void;
} {
  const cryer = new Cryer(options);
  
  // Regular middleware to monitor response status
  const middleware = (req: Request, res: Response, next: NextFunction) => {
    // Add a flag to track if this request has already reported an error
    const responseLocal = res.locals as any;
    responseLocal.__cryerErrorReported = false;
    
    // Store the original methods
    const originalSend = res.send;
    const originalEnd = res.end;
    
    // Override send
    res.send = function(body?: any): Response {
      // Only report if status is 500+ and we haven't reported this error yet
      if (res.statusCode >= 500 && !responseLocal.__cryerErrorReported) {
        const serverError = new Error(`Server error: ${res.statusCode}`);
        const errorWithMeta = serverError as any;
        errorWithMeta.severity = 'critical';
        errorWithMeta.responseBody = body;
        errorWithMeta.path = req.path;
        errorWithMeta.method = req.method;
        
        cryer.reportError(errorWithMeta, req, res);
        
        // Mark as reported
        responseLocal.__cryerErrorReported = true;
      }
      return originalSend.call(this, body);
    };
    
    // Override end
    res.end = function(
      chunk?: any, 
      encodingOrCallback?: string | (() => void),
      callback?: () => void
    ): Response {
      // Only report if status is 500+ and we haven't reported this error yet
      if (res.statusCode >= 500 && !responseLocal.__cryerErrorReported) {
        const serverError = new Error(`Server error: ${res.statusCode}`);
        const errorWithMeta = serverError as any;
        errorWithMeta.severity = 'critical';
        errorWithMeta.path = req.path;
        errorWithMeta.method = req.method;
        
        cryer.reportError(errorWithMeta, req, res);
        
        // Mark as reported
        responseLocal.__cryerErrorReported = true;
      }
      return originalEnd.apply(this, arguments as any);
    };
    
    next();
  };
  
  // Error handler middleware for caught exceptions
  const errorHandler: ErrorRequestHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    const responseLocal = res.locals as any;
    
    // Only handle if not already reported
    if (!responseLocal.__cryerErrorReported) {
      const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
      let severity: 'critical' | 'high' | 'medium' | 'low' = options.defaultSeverity || 'medium';
      
      if (statusCode >= 500) {
        severity = 'critical';
      } else if (statusCode >= 400) {
        severity = 'high';
      }
      
      if (res.statusCode === 200) {
        res.status(statusCode);
      }
      
      const errorWithMeta = err as any;
      errorWithMeta.severity = severity;
      
      cryer.reportError(errorWithMeta, req, res);
      
      // Mark as reported
      responseLocal.__cryerErrorReported = true;
    }
    
    next(err);
  };
  
  return { middleware, errorHandler };
}