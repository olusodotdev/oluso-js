"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sanitizer = void 0;
const DEFAULT_SENSITIVE_KEYS = [
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'api_key',
    'apikey',
    'access_token',
    'auth',
    'credentials',
    'mysql_pwd',
    'private_key',
    'privatekey',
    'session',
    'cookie',
    'csrf',
    'xsrf',
    'authorization',
    'bearer',
    'jwt',
    'ssn',
    'social_security',
    'credit_card',
    'card_number',
    'cvv',
    'pin',
];
const REDACTED = '[REDACTED]';
class Sanitizer {
    constructor(customSensitiveKeys = []) {
        const allKeys = [...DEFAULT_SENSITIVE_KEYS, ...customSensitiveKeys];
        this.sensitivePatterns = allKeys.map((key) => new RegExp(key, 'i'));
    }
    /**
     * Check if a key is sensitive
     */
    isSensitiveKey(key) {
        return this.sensitivePatterns.some((pattern) => pattern.test(key));
    }
    /**
     * Sanitize an object by removing sensitive data
     */
    sanitizeObject(obj, maxDepth = 10) {
        if (maxDepth <= 0) {
            return '[Max Depth Reached]';
        }
        if (obj === null || obj === undefined) {
            return obj;
        }
        // Handle circular references
        const seen = new WeakSet();
        const sanitize = (value, depth) => {
            if (depth <= 0) {
                return '[Max Depth Reached]';
            }
            if (value === null || value === undefined) {
                return value;
            }
            // Handle primitives
            if (typeof value !== 'object') {
                return value;
            }
            // Handle circular references
            if (seen.has(value)) {
                return '[Circular Reference]';
            }
            seen.add(value);
            // Handle arrays
            if (Array.isArray(value)) {
                return value.map((item) => sanitize(item, depth - 1));
            }
            // Handle dates
            if (value instanceof Date) {
                return value.toISOString();
            }
            // Handle errors
            if (value instanceof Error) {
                return {
                    name: value.name,
                    message: value.message,
                    stack: value.stack,
                };
            }
            // Handle regular objects
            const sanitized = {};
            for (const key in value) {
                if (value.hasOwnProperty(key)) {
                    if (this.isSensitiveKey(key)) {
                        sanitized[key] = REDACTED;
                    }
                    else {
                        sanitized[key] = sanitize(value[key], depth - 1);
                    }
                }
            }
            return sanitized;
        };
        return sanitize(obj, maxDepth);
    }
    /**
     * Sanitize request headers
     */
    sanitizeHeaders(headers) {
        const sanitized = {};
        for (const key in headers) {
            if (headers.hasOwnProperty(key)) {
                const lowerKey = key.toLowerCase();
                // Always redact authorization headers
                if (lowerKey === 'authorization' || lowerKey === 'cookie') {
                    sanitized[key] = REDACTED;
                }
                else if (this.isSensitiveKey(key)) {
                    sanitized[key] = REDACTED;
                }
                else {
                    sanitized[key] = String(headers[key]);
                }
            }
        }
        return sanitized;
    }
    /**
     * Sanitize request body
     */
    sanitizeBody(body) {
        return this.sanitizeObject(body);
    }
    /**
     * Sanitize query parameters
     */
    sanitizeQuery(query) {
        return this.sanitizeObject(query);
    }
    /**
     * Limit string length to prevent huge payloads
     */
    truncateString(str, maxLength = 1000) {
        if (str.length <= maxLength) {
            return str;
        }
        return str.substring(0, maxLength) + '... [truncated]';
    }
}
exports.Sanitizer = Sanitizer;
exports.default = Sanitizer;
