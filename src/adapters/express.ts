import { Cryer } from '../index';
import { CryerOptions } from '../types';
import { Request, Response, NextFunction } from 'express';

/**
 * Express middleware for Cryer error monitoring
 * 
 * This middleware automatically detects whether it's being called as:
 * - Regular middleware (3 params): Tracks request context and response times
 * - Error handler (4 params): Captures and reports errors
 * 
 * Usage:
 * ```
 * app.use(cryerExpress(options));
 * ```
 */
export function cryerExpress(options: CryerOptions) {
  const cryer = new Cryer(options);
  const contextManager = cryer.getContextManager();

  // Return a middleware that handles both regular requests and errors
  return function cryerMiddleware(
    err: any,
    req: Request | Response,
    res: Response | NextFunction,
    next?: NextFunction
  ) {
    // Detect if this is an error handler (4 parameters) or regular middleware (3 parameters)
    const isErrorHandler = arguments.length === 4;

    if (isErrorHandler) {
      // Called as error handler: (err, req, res, next)
      const error = err as Error;
      const request = req as Request;
      const response = res as Response;
      const nextFn = next as NextFunction;

      handleError(cryer, contextManager, error, request, response, nextFn, options);
    } else {
      // Called as regular middleware: (req, res, next)
      const request = err as any as Request;
      const response = req as any as Response;
      const nextFn = res as any as NextFunction;

      handleRequest(cryer, contextManager, request, response, nextFn);
    }
  };
}

/**
 * Handle regular requests - track context and monitor responses
 */
function handleRequest(
  cryer: Cryer,
  contextManager: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Run in async context
  contextManager.run(() => {
    // Track request start time
    contextManager.setRequestStartTime(Date.now());

    // Add breadcrumb for incoming request
    cryer.addBreadcrumb({
      message: `${req.method} ${req.path}`,
      level: 'info',
      category: 'http',
      data: {
        method: req.method,
        url: req.path,
        query: req.query,
      },
    });

    // Store original methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    // Track if error was already reported
    let errorReported = false;

    // Override send
    res.send = function (body?: any): Response {
      if (res.statusCode >= 500 && !errorReported) {
        errorReported = true;
        const serverError = new Error(`Server error: ${res.statusCode} - ${req.method} ${req.path}`);
        (serverError as any).severity = 'critical';
        cryer.reportError(serverError, req, res);
      }
      return originalSend.call(this, body);
    };

    // Override json
    res.json = function (body?: any): Response {
      if (res.statusCode >= 500 && !errorReported) {
        errorReported = true;
        const serverError = new Error(`Server error: ${res.statusCode} - ${req.method} ${req.path}`);
        (serverError as any).severity = 'critical';
        cryer.reportError(serverError, req, res);
      }
      return originalJson.call(this, body);
    };

    // Override end
    res.end = function (...args: any[]): Response {
      if (res.statusCode >= 500 && !errorReported) {
        errorReported = true;
        const serverError = new Error(`Server error: ${res.statusCode} - ${req.method} ${req.path}`);
        (serverError as any).severity = 'critical';
        cryer.reportError(serverError, req, res);
      }
      return originalEnd.apply(this, args as any);
    };

    // Add response finish listener for breadcrumb
    res.on('finish', () => {
      const startTime = contextManager.getRequestStartTime();
      const duration = startTime ? Date.now() - startTime : 0;

      cryer.addBreadcrumb({
        message: `Response ${res.statusCode} - ${req.method} ${req.path}`,
        level: res.statusCode >= 400 ? 'error' : 'info',
        category: 'http',
        data: {
          statusCode: res.statusCode,
          duration,
        },
      });
    });

    next();
  });
}

/**
 * Handle errors - capture and report
 */
function handleError(
  cryer: Cryer,
  contextManager: any,
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
  options: CryerOptions
) {
  // Determine status code and severity
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  let severity: 'critical' | 'high' | 'medium' | 'low' = options.defaultSeverity || 'medium';

  if (statusCode >= 500) {
    severity = 'critical';
  } else if (statusCode >= 400) {
    severity = 'high';
  }

  // Set status code if not already set
  if (res.statusCode === 200) {
    res.status(statusCode);
  }

  // Add severity to error
  (err as any).severity = severity;

  // Add breadcrumb for error
  cryer.addBreadcrumb({
    message: `Error: ${err.message}`,
    level: 'error',
    category: 'error',
    data: {
      errorType: err.constructor.name,
      statusCode,
    },
  });

  // Report the error
  cryer.reportError(err, req, res);

  // Pass to next error handler
  next(err);
}