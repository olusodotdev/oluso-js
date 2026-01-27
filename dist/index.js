"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cryer = void 0;
const https_1 = require("./utils/https");
const context_1 = __importDefault(require("./utils/context"));
const sanitizer_1 = __importDefault(require("./utils/sanitizer"));
const fingerprint_1 = __importDefault(require("./utils/fingerprint"));
const server_1 = require("./utils/server");
const queue_1 = __importDefault(require("./utils/queue"));
__exportStar(require("./types"), exports);
__exportStar(require("./adapters/express"), exports);
__exportStar(require("./adapters/nest"), exports);
class Cryer {
    constructor(options) {
        this.reportUrl = 'https://crier-test.onrender.com/api/v1/error/report';
        this.globalHandlersRegistered = false;
        // Set default options
        this.options = {
            logToConsole: true,
            timeout: 5000,
            environment: 'development',
            defaultSeverity: 'medium',
            maxBreadcrumbs: 30,
            enableSourceMaps: false,
            enableOfflineQueue: true,
            maxQueueSize: 100,
            maxErrorsPerMinute: 60,
            includeRequestBody: true,
            includeRequestHeaders: true,
            ...options
        };
        // Initialize utilities
        this.contextManager = new context_1.default(this.options.maxBreadcrumbs);
        this.sanitizer = new sanitizer_1.default(this.options.sensitiveKeys);
        this.rateLimiter = new server_1.RateLimiter(this.options.maxErrorsPerMinute);
        this.offlineQueue = new queue_1.default(this.options.maxQueueSize);
        // Register global uncaught exception handler
        this.registerGlobalHandlers();
    }
    registerGlobalHandlers() {
        if (this.globalHandlersRegistered)
            return;
        this.globalHandlersRegistered = true;
        // Uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.addBreadcrumb({
                message: 'Uncaught exception occurred',
                level: 'error',
                category: 'error',
            });
            this.reportError(error);
        });
        // Unhandled promise rejections
        process.on('unhandledRejection', (reason) => {
            this.addBreadcrumb({
                message: 'Unhandled promise rejection',
                level: 'error',
                category: 'promise',
            });
            if (reason instanceof Error) {
                this.reportError(reason);
            }
            else {
                this.reportError(new Error(`Unhandled rejection: ${String(reason)}`));
            }
        });
        // Warning events
        process.on('warning', (warning) => {
            this.addBreadcrumb({
                message: `Process warning: ${warning.name}`,
                level: 'warning',
                category: 'warning',
                data: {
                    name: warning.name,
                    message: warning.message,
                },
            });
        });
        // Handle worker thread errors if in worker context
        if (typeof process.on === 'function') {
            try {
                const worker_threads = require('worker_threads');
                if (worker_threads.parentPort) {
                    worker_threads.parentPort.on('error', (error) => {
                        this.addBreadcrumb({
                            message: 'Worker thread error',
                            level: 'error',
                            category: 'worker',
                        });
                        this.reportError(error);
                    });
                }
            }
            catch (err) {
                // worker_threads not available, skip
            }
        }
        // Handle cluster worker errors
        try {
            const cluster = require('cluster');
            if (cluster.isWorker) {
                process.on('disconnect', () => {
                    this.addBreadcrumb({
                        message: 'Cluster worker disconnected',
                        level: 'warning',
                        category: 'cluster',
                    });
                });
            }
        }
        catch (err) {
            // cluster not available, skip
        }
    }
    /**
     * Add a breadcrumb to track events leading to errors
     */
    addBreadcrumb(breadcrumb) {
        this.contextManager.addBreadcrumb(breadcrumb);
    }
    /**
     * Set user context for error reports
     */
    setUserContext(user) {
        this.contextManager.setUserContext(user);
    }
    /**
     * Set custom context data
     */
    setCustomContext(key, value) {
        this.contextManager.setCustomContext(key, value);
    }
    /**
     * Capture and report an error with optional context
     */
    captureException(error, customContext) {
        if (customContext) {
            for (const [key, value] of Object.entries(customContext)) {
                this.setCustomContext(key, value);
            }
        }
        return this.reportError(error);
    }
    /**
     * Flush all queued errors
     */
    async flush() {
        await this.offlineQueue.processQueue((report) => (0, https_1.sendErrorReport)(this.reportUrl, report, {
            apiKey: this.options.apiKey,
            timeout: this.options.timeout
        }));
    }
    /**
     * Report an error to the API
     */
    reportError(error, req, res) {
        // Check if we should report this error
        if (this.options.shouldReport && !this.options.shouldReport(error, req, res)) {
            return Promise.resolve();
        }
        // Check rate limit
        if (!this.rateLimiter.canSend()) {
            if (this.options.logToConsole) {
                console.warn('[Cryer] Rate limit exceeded, error not reported');
            }
            return Promise.resolve();
        }
        // Log to console if enabled
        if (this.options.logToConsole) {
            console.error('[Cryer]', error);
        }
        // Build error context
        const context = this.buildErrorContext(req, res);
        // Generate fingerprint
        const fingerprint = this.options.fingerprint
            ? this.options.fingerprint(error, context)
            : (0, fingerprint_1.default)(error, context);
        // Extract a short title from the error message
        const title = this.generateErrorTitle(error);
        // Prepare error report
        const report = {
            title: title,
            message: error.message,
            stack_trace: error.stack,
            environment: this.options.environment,
            severity: this.extractSeverity(error, res),
            tags: this.generateTags(error, req),
            fingerprint: fingerprint,
            context: context,
            timestamp: Date.now(),
        };
        // Send the report
        return this.sendReport(report);
    }
    /**
     * Build error context from request and stored context
     */
    buildErrorContext(req, res) {
        var _a, _b;
        const context = {
            server: (0, server_1.getServerContext)(),
            ...this.contextManager.getContext(),
        };
        // Add request context if available
        if (req) {
            const requestStartTime = this.contextManager.getRequestStartTime();
            const responseTime = requestStartTime
                ? Date.now() - requestStartTime
                : undefined;
            context.request = {
                url: req.url || req.path || req.originalUrl || '',
                method: req.method || '',
                headers: this.options.includeRequestHeaders
                    ? this.sanitizer.sanitizeHeaders(req.headers || {})
                    : undefined,
                query: req.query ? this.sanitizer.sanitizeQuery(req.query) : undefined,
                body: this.options.includeRequestBody && req.body
                    ? this.sanitizer.sanitizeBody(req.body)
                    : undefined,
                params: req.params ? this.sanitizer.sanitizeObject(req.params) : undefined,
                ip: req.ip || ((_a = req.connection) === null || _a === void 0 ? void 0 : _a.remoteAddress),
                userAgent: (_b = req.headers) === null || _b === void 0 ? void 0 : _b['user-agent'],
                responseTime,
            };
        }
        return context;
    }
    /**
     * Send error report to API or queue if offline
     */
    async sendReport(report) {
        try {
            await (0, https_1.sendErrorReport)(this.reportUrl, report, {
                apiKey: this.options.apiKey,
                timeout: this.options.timeout
            });
            // If successful and queue is enabled, try to process queued errors
            if (this.options.enableOfflineQueue && !this.offlineQueue.isEmpty()) {
                this.offlineQueue.processQueue((queuedReport) => (0, https_1.sendErrorReport)(this.reportUrl, queuedReport, {
                    apiKey: this.options.apiKey,
                    timeout: this.options.timeout
                })).catch(() => {
                    // Silently fail queue processing
                });
            }
        }
        catch (err) {
            // If sending failed and offline queue is enabled, queue the report
            if (this.options.enableOfflineQueue) {
                this.offlineQueue.enqueue(report);
            }
        }
    }
    generateErrorTitle(error) {
        // Extract the first line of the error message or use the constructor name
        const firstLine = error.message.split('\n')[0].trim();
        if (firstLine && firstLine.length > 0) {
            // Limit title length
            return firstLine.length <= 100 ? firstLine : `${firstLine.substring(0, 97)}...`;
        }
        return `${error.constructor.name} Error`;
    }
    extractSeverity(error, res) {
        // Check if severity is explicitly set on the error
        if (error.severity) {
            return error.severity;
        }
        // Determine severity based on status code if available
        if (res && res.statusCode) {
            if (res.statusCode >= 500)
                return 'critical';
            if (res.statusCode >= 400)
                return 'high';
        }
        // Use default severity
        return this.options.defaultSeverity || 'medium';
    }
    generateTags(error, req) {
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
    /**
     * Get the context manager for advanced usage
     */
    getContextManager() {
        return this.contextManager;
    }
}
exports.Cryer = Cryer;
