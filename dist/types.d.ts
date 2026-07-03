export interface OlusoOptions {
    /** API key for authentication (will be sent as x-oluso-signature header) */
    apiKey: string;
    /** Environment name (development, production, staging, etc.) */
    environment?: string;
    /** Default severity level for errors */
    defaultSeverity?: 'critical' | 'high' | 'medium' | 'low';
    /** Tags for categorizing errors */
    tags?: string[];
    /** Filter function to determine if an error should be reported */
    shouldReport?: (err: Error, req?: any, res?: any) => boolean;
    /** Timeout in milliseconds for API calls (default: 5000) */
    timeout?: number;
    /** Whether to log errors to console in addition to reporting (default: true) */
    logToConsole?: boolean;
    /** Maximum number of breadcrumbs to keep (default: 30) */
    maxBreadcrumbs?: number;
    /** Enable source map support for stack traces (default: false) */
    enableSourceMaps?: boolean;
    /** Enable offline queue for failed reports (default: true) */
    enableOfflineQueue?: boolean;
    /** Maximum number of errors to queue offline (default: 100) */
    maxQueueSize?: number;
    /** Rate limit: maximum errors per minute (default: 60) */
    maxErrorsPerMinute?: number;
    /** Patterns for sanitizing sensitive data from requests */
    sensitiveKeys?: string[];
    /** Custom fingerprint function for error deduplication */
    fingerprint?: (error: Error, context?: ErrorContext) => string;
    /** Include request body in error reports (default: true, will be sanitized) */
    includeRequestBody?: boolean;
    /** Include request headers in error reports (default: true, will be sanitized) */
    includeRequestHeaders?: boolean;
}
export interface ErrorReport {
    title: string;
    message: string;
    stack_trace?: string;
    environment?: string;
    severity?: string;
    tags?: string[];
    fingerprint?: string;
    context?: ErrorContext;
    timestamp?: number;
}
export interface ErrorContext {
    request?: RequestContext;
    user?: UserContext;
    server?: ServerContext;
    custom?: Record<string, any>;
    breadcrumbs?: Breadcrumb[];
}
export interface Breadcrumb {
    timestamp: number;
    message: string;
    level: 'debug' | 'info' | 'warning' | 'error';
    category?: string;
    data?: Record<string, any>;
}
export interface RequestContext {
    url: string;
    method: string;
    headers?: Record<string, string>;
    query?: Record<string, any>;
    body?: any;
    params?: Record<string, any>;
    ip?: string;
    userAgent?: string;
    responseTime?: number;
}
export interface UserContext {
    id?: string;
    email?: string;
    username?: string;
    [key: string]: any;
}
export interface ServerContext {
    hostname: string;
    platform: string;
    nodeVersion: string;
    processId: number;
    memory: {
        used: number;
        total: number;
    };
    uptime: number;
}
