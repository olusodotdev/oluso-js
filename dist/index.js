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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cryer = void 0;
const https_1 = require("./utils/https");
__exportStar(require("./types"), exports);
__exportStar(require("./adapters/express"), exports);
__exportStar(require("./adapters/nest"), exports);
class Cryer {
    constructor(options) {
        this.reportUrl = 'https://crier-test.onrender.com/api/v1/error/report';
        // Set default options
        this.options = {
            logToConsole: true,
            timeout: 5000,
            environment: 'development',
            defaultSeverity: 'medium',
            ...options
        };
        // Register global uncaught exception handler
        this.registerGlobalHandlers();
    }
    registerGlobalHandlers() {
        process.on('uncaughtException', (error) => {
            this.reportError(error);
        });
        process.on('unhandledRejection', (reason) => {
            if (reason instanceof Error) {
                this.reportError(reason);
            }
            else {
                this.reportError(new Error(`Unhandled rejection: ${String(reason)}`));
            }
        });
    }
    reportError(error, req, res) {
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
        const report = {
            title: title,
            message: error.message,
            stack_trace: error.stack,
            environment: this.options.environment,
            severity: this.extractSeverity(error, res),
            tags: this.generateTags(error, req)
        };
        // Send the report
        return (0, https_1.sendErrorReport)(this.reportUrl, report, {
            apiKey: this.options.apiKey,
            timeout: this.options.timeout
        });
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
}
exports.Cryer = Cryer;
