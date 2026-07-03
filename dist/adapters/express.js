"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.olusoExpress = olusoExpress;
const index_1 = require("../index");
/**
 * Express middleware for Oluso error monitoring
 *
 * This middleware automatically detects whether it's being called as:
 * - Regular middleware (3 params): Tracks request context and response times
 * - Error handler (4 params): Captures and reports errors
 *
 * Usage:
 * ```
 * app.use(olusoExpress(options));
 * ```
 */
function olusoExpress(options) {
    const oluso = new index_1.Oluso(options);
    const contextManager = oluso.getContextManager();
    // Return a middleware that handles both regular requests and errors
    return function olusoMiddleware(err, req, res, next) {
        // Detect if this is an error handler (4 parameters) or regular middleware (3 parameters)
        const isErrorHandler = arguments.length === 4;
        if (isErrorHandler) {
            // Called as error handler: (err, req, res, next)
            const error = err;
            const request = req;
            const response = res;
            const nextFn = next;
            handleError(oluso, contextManager, error, request, response, nextFn, options);
        }
        else {
            // Called as regular middleware: (req, res, next)
            const request = err;
            const response = req;
            const nextFn = res;
            handleRequest(oluso, contextManager, request, response, nextFn);
        }
    };
}
/**
 * Handle regular requests - track context and monitor responses
 */
function handleRequest(oluso, contextManager, req, res, next) {
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
        // Track if error was already reported
        let errorReported = false;
        // Override send
        res.send = function (body) {
            if (res.statusCode >= 500 && !errorReported) {
                errorReported = true;
                const serverError = new Error(`Server error: ${res.statusCode} - ${req.method} ${req.path}`);
                serverError.severity = 'critical';
                oluso.reportError(serverError, req, res);
            }
            return originalSend.call(this, body);
        };
        // Override json
        res.json = function (body) {
            if (res.statusCode >= 500 && !errorReported) {
                errorReported = true;
                const serverError = new Error(`Server error: ${res.statusCode} - ${req.method} ${req.path}`);
                serverError.severity = 'critical';
                oluso.reportError(serverError, req, res);
            }
            return originalJson.call(this, body);
        };
        // Override end
        res.end = function (...args) {
            if (res.statusCode >= 500 && !errorReported) {
                errorReported = true;
                const serverError = new Error(`Server error: ${res.statusCode} - ${req.method} ${req.path}`);
                serverError.severity = 'critical';
                oluso.reportError(serverError, req, res);
            }
            return originalEnd.apply(this, args);
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
function handleError(oluso, contextManager, err, req, res, next, options) {
    // Determine status code and severity
    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
    let severity = options.defaultSeverity || 'medium';
    if (statusCode >= 500) {
        severity = 'critical';
    }
    else if (statusCode >= 400) {
        severity = 'high';
    }
    // Set status code if not already set
    if (res.statusCode === 200) {
        res.status(statusCode);
    }
    // Add severity to error
    err.severity = severity;
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
    // Pass to next error handler
    next(err);
}
