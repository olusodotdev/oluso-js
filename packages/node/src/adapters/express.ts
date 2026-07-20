import { Oluso } from '../index';
import { OlusoOptions } from '../types';
import { Request, Response, NextFunction } from 'express';

/**
 * Creates Express middleware for Oluso error monitoring.
 *
 * Express decides whether a middleware is a regular handler or an
 * error handler purely by counting its declared parameters (`fn.length`) --
 * a single function trying to serve both roles at once is never actually
 * dispatched as a regular handler by Express, regardless of how many
 * arguments are passed at call time. So this returns two separate,
 * correctly-shaped middlewares that share one Oluso instance (same
 * breadcrumb/context state across both).
 *
 * Usage:
 * ```
 * const oluso = olusoExpress(options);
 * app.use(oluso.requestHandler);   // mount first, before your routes
 * // ...your routes...
 * app.use(oluso.errorHandler);     // mount last, after your routes
 * ```
 *
 * Both handlers matter: requestHandler alone will still catch any
 * response your app sends with status >= 500, even without next(err) --
 * but only as a synthetic "Server error: 500 - ..." message. errorHandler
 * is what reports the *real* error object/stack, and only fires for
 * errors that reach it (a route throwing synchronously, or an explicit
 * next(err) call -- Express 4 does not auto-forward rejected promises
 * from async handlers, so wrap those in try/catch + next(err) yourself).
 *
 * requestHandler/errorHandler only ever see errors that pass through
 * Express's request/response cycle. Anything outside that -- a
 * node-cron/BullMQ job, a setInterval loop, a message-queue consumer --
 * is invisible to both, *and* invisible to the global uncaughtException/
 * unhandledRejection handlers too if that code catches its own errors
 * (even just to console.error them) rather than letting them throw/reject.
 * captureException/addBreadcrumb/setUserContext are re-exported here, on
 * the same Oluso instance requestHandler/errorHandler already use, so
 * that code can still report explicitly:
 * ```
 * const oluso = olusoExpress(options);
 * cron.schedule('0 21 * * *', async () => {
 *   try {
 *     await deleteStaleTasks();
 *   } catch (err) {
 *     oluso.captureException(err); // otherwise this failure is invisible
 *   }
 * });
 * ```
 */
export function olusoExpress(options: OlusoOptions) {
  const oluso = new Oluso(options);
  const contextManager = oluso.getContextManager();

  return {
    requestHandler: function olusoRequestHandler(req: Request, res: Response, next: NextFunction) {
      handleRequest(oluso, contextManager, req, res, next);
    },
    errorHandler: function olusoErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
      handleError(oluso, contextManager, err, req, res, next, options);
    },
    captureException: oluso.captureException.bind(oluso),
    addBreadcrumb: oluso.addBreadcrumb.bind(oluso),
    setUserContext: oluso.setUserContext.bind(oluso),
    setCustomContext: oluso.setCustomContext.bind(oluso),
    flush: oluso.flush.bind(oluso),
  };
}

/**
 * Handle regular requests - track context and monitor responses
 */
function handleRequest(
  oluso: Oluso,
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
    oluso.addBreadcrumb({
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

    // Whether an error was already reported for *this response* -- stored
    // on res itself (not a local closure variable) because handleError
    // below runs in a separate middleware invocation but shares the same
    // res per request. Without this shared flag, a route that throws and
    // calls next(err) gets its real error correctly reported by
    // handleError, then this same request's downstream res.json/send/end
    // (once errorHandler calls next(err) onward) sees a >=500 status and
    // fires a second, synthetic "Server error: N - ..." report for the
    // exact same failure -- duplicating it with a report that has no
    // connection to the real error or its stack trace.
    const alreadyReported = () => (res as any).__olusoErrorReported === true;
    const markReported = () => {
      (res as any).__olusoErrorReported = true;
    };

    // Override send
    res.send = function (body?: any): Response {
      if (res.statusCode >= 500 && !alreadyReported()) {
        markReported();
        const serverError = new Error(`Server error: ${res.statusCode} - ${req.method} ${req.path}`);
        (serverError as any).severity = 'critical';
        oluso.reportError(serverError, req, res);
      }
      return originalSend.call(this, body);
    };

    // Override json
    res.json = function (body?: any): Response {
      if (res.statusCode >= 500 && !alreadyReported()) {
        markReported();
        const serverError = new Error(`Server error: ${res.statusCode} - ${req.method} ${req.path}`);
        (serverError as any).severity = 'critical';
        oluso.reportError(serverError, req, res);
      }
      return originalJson.call(this, body);
    };

    // Override end
    res.end = function (...args: any[]): Response {
      if (res.statusCode >= 500 && !alreadyReported()) {
        markReported();
        const serverError = new Error(`Server error: ${res.statusCode} - ${req.method} ${req.path}`);
        (serverError as any).severity = 'critical';
        oluso.reportError(serverError, req, res);
      }
      return originalEnd.apply(this, args as any);
    };

    // Add response finish listener for breadcrumb
    res.on('finish', () => {
      const startTime = contextManager.getRequestStartTime();
      const duration = startTime ? Date.now() - startTime : 0;

      oluso.addBreadcrumb({
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
  oluso: Oluso,
  contextManager: any,
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
  options: OlusoOptions
) {
  // Determine status code and severity. Respect the error's own status
  // first (e.g. a business-rule error like "insufficient stock" thrown
  // with `.status = 409`) -- defaulting straight to 500 here, ignoring
  // what the error itself says, was overwriting a real 409 into a 500
  // on the response, which in turn made requestHandler's res.json/send/end
  // wrapper (see handleRequest above) think an unreported 500-level
  // failure had occurred and fire a second, misleading synthetic report.
  const errStatus = (err as any).status || (err as any).statusCode;
  const statusCode = res.statusCode !== 200 ? res.statusCode : errStatus || 500;
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
  oluso.addBreadcrumb({
    message: `Error: ${err.message}`,
    level: 'error',
    category: 'error',
    data: {
      errorType: err.constructor.name,
      statusCode,
    },
  });

  // Report the error
  oluso.reportError(err, req, res);

  // Shares the "already reported" state with requestHandler's res.json/
  // send/end overrides (see handleRequest above) -- without this, whatever
  // downstream code sends the actual response after next(err) would look
  // like an unreported >=500 failure and get a second, synthetic report.
  (res as any).__olusoErrorReported = true;

  // Pass to next error handler
  next(err);
}
