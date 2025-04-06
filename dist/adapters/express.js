"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cryerExpress = cryerExpress;
const index_1 = require("../index");
// Create a middleware factory function that returns both regular and error handler middleware
function cryerExpress(options) {
    const cryer = new index_1.Cryer(options);
    // Regular middleware to monitor response status
    const middleware = (req, res, next) => {
        // Add a flag to track if this request has already reported an error
        const responseLocal = res.locals;
        responseLocal.__cryerErrorReported = false;
        // Store the original methods
        const originalSend = res.send;
        const originalEnd = res.end;
        // Override send
        res.send = function (body) {
            // Only report if status is 500+ and we haven't reported this error yet
            if (res.statusCode >= 500 && !responseLocal.__cryerErrorReported) {
                const serverError = new Error(`Server error: ${res.statusCode}`);
                const errorWithMeta = serverError;
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
        res.end = function (chunk, encodingOrCallback, callback) {
            // Only report if status is 500+ and we haven't reported this error yet
            if (res.statusCode >= 500 && !responseLocal.__cryerErrorReported) {
                const serverError = new Error(`Server error: ${res.statusCode}`);
                const errorWithMeta = serverError;
                errorWithMeta.severity = 'critical';
                errorWithMeta.path = req.path;
                errorWithMeta.method = req.method;
                cryer.reportError(errorWithMeta, req, res);
                // Mark as reported
                responseLocal.__cryerErrorReported = true;
            }
            return originalEnd.apply(this, arguments);
        };
        next();
    };
    // Error handler middleware for caught exceptions
    const errorHandler = (err, req, res, next) => {
        const responseLocal = res.locals;
        // Only handle if not already reported
        if (!responseLocal.__cryerErrorReported) {
            const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
            let severity = options.defaultSeverity || 'medium';
            if (statusCode >= 500) {
                severity = 'critical';
            }
            else if (statusCode >= 400) {
                severity = 'high';
            }
            if (res.statusCode === 200) {
                res.status(statusCode);
            }
            const errorWithMeta = err;
            errorWithMeta.severity = severity;
            cryer.reportError(errorWithMeta, req, res);
            // Mark as reported
            responseLocal.__cryerErrorReported = true;
        }
        next(err);
    };
    return { middleware, errorHandler };
}
