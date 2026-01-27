export declare class Sanitizer {
    private sensitivePatterns;
    constructor(customSensitiveKeys?: string[]);
    /**
     * Check if a key is sensitive
     */
    private isSensitiveKey;
    /**
     * Sanitize an object by removing sensitive data
     */
    sanitizeObject(obj: any, maxDepth?: number): any;
    /**
     * Sanitize request headers
     */
    sanitizeHeaders(headers: Record<string, any>): Record<string, string>;
    /**
     * Sanitize request body
     */
    sanitizeBody(body: any): any;
    /**
     * Sanitize query parameters
     */
    sanitizeQuery(query: Record<string, any>): Record<string, any>;
    /**
     * Limit string length to prevent huge payloads
     */
    truncateString(str: string, maxLength?: number): string;
}
export default Sanitizer;
