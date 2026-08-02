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

// Call hasOwnProperty off Object.prototype rather than off the value itself.
// `value.hasOwnProperty(key)` throws "hasOwnProperty is not a function" when
// value is a null-prototype object (Object.create(null) -- e.g. some ORM rows,
// parsed query objects) or when a payload carries its own `hasOwnProperty`
// key. That crash was firing inside reportError's own sanitize pass, so the
// SDK was throwing while trying to report an unrelated error.
const hasOwn = Object.prototype.hasOwnProperty;

export class Sanitizer {
    private sensitivePatterns: RegExp[];

    constructor(customSensitiveKeys: string[] = []) {
        const allKeys = [...DEFAULT_SENSITIVE_KEYS, ...customSensitiveKeys];
        this.sensitivePatterns = allKeys.map(
            (key) => new RegExp(key, 'i')
        );
    }

    /**
     * Check if a key is sensitive
     */
    private isSensitiveKey(key: string): boolean {
        return this.sensitivePatterns.some((pattern) => pattern.test(key));
    }

    /**
     * Sanitize an object by removing sensitive data
     */
    sanitizeObject(obj: any, maxDepth: number = 10): any {
        if (maxDepth <= 0) {
            return '[Max Depth Reached]';
        }

        if (obj === null || obj === undefined) {
            return obj;
        }

        // Handle circular references
        const seen = new WeakSet();

        const sanitize = (value: any, depth: number): any => {
            if (depth <= 0) {
                return '[Max Depth Reached]';
            }

            if (value === null || value === undefined) {
                return value;
            }

            // Handle primitives
            if (typeof value !== 'object') {
                return typeof value === 'string' ? this.truncateString(value, 4000) : value;
            }

            if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) {
                return `[Binary ${value.byteLength} bytes]`;
            }

            // Handle circular references
            if (seen.has(value)) {
                return '[Circular Reference]';
            }
            seen.add(value);

            // Handle arrays
            if (Array.isArray(value)) {
                const items = value.slice(0, 100).map((item) => sanitize(item, depth - 1));
                if (value.length > 100) items.push(`[${value.length - 100} more items truncated]`);
                return items;
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
            const sanitized: any = {};
            let keyCount = 0;
            for (const key in value) {
                if (hasOwn.call(value, key)) {
                    if (keyCount >= 200) {
                        sanitized._truncated = true;
                        break;
                    }
                    if (this.isSensitiveKey(key)) {
                        sanitized[key] = REDACTED;
                    } else {
                        sanitized[key] = sanitize(value[key], depth - 1);
                    }
                    keyCount++;
                }
            }

            return sanitized;
        };

        return sanitize(obj, maxDepth);
    }

    /**
     * Sanitize request headers
     */
    sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
        const sanitized: Record<string, string> = {};

        for (const key in headers) {
            if (hasOwn.call(headers, key)) {
                const lowerKey = key.toLowerCase();

                // Always redact authorization headers
                if (lowerKey === 'authorization' || lowerKey === 'cookie') {
                    sanitized[key] = REDACTED;
                } else if (this.isSensitiveKey(key)) {
                    sanitized[key] = REDACTED;
                } else {
                    sanitized[key] = String(headers[key]);
                }
            }
        }

        return sanitized;
    }

    /**
     * Sanitize request body
     */
    sanitizeBody(body: any): any {
        return this.sanitizeObject(body);
    }

    /**
     * Sanitize query parameters
     */
    sanitizeQuery(query: Record<string, any>): Record<string, any> {
        return this.sanitizeObject(query);
    }

    /**
     * Limit string length to prevent huge payloads
     */
    truncateString(str: string, maxLength: number = 1000): string {
        if (str.length <= maxLength) {
            return str;
        }
        return str.substring(0, maxLength) + '... [truncated]';
    }
}

export default Sanitizer;
