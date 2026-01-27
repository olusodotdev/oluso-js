import { CryerOptions, Breadcrumb, UserContext } from './types';
import ContextManager from './utils/context';
export * from './types';
export * from './adapters/express';
export * from './adapters/nest';
export declare class Cryer {
    private options;
    private reportUrl;
    private contextManager;
    private sanitizer;
    private rateLimiter;
    private offlineQueue;
    private globalHandlersRegistered;
    constructor(options: CryerOptions);
    private registerGlobalHandlers;
    /**
     * Add a breadcrumb to track events leading to errors
     */
    addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void;
    /**
     * Set user context for error reports
     */
    setUserContext(user: UserContext): void;
    /**
     * Set custom context data
     */
    setCustomContext(key: string, value: any): void;
    /**
     * Capture and report an error with optional context
     */
    captureException(error: Error, customContext?: Record<string, any>): Promise<void>;
    /**
     * Flush all queued errors
     */
    flush(): Promise<void>;
    /**
     * Report an error to the API
     */
    reportError(error: Error, req?: any, res?: any): Promise<void>;
    /**
     * Build error context from request and stored context
     */
    private buildErrorContext;
    /**
     * Send error report to API or queue if offline
     */
    private sendReport;
    private generateErrorTitle;
    private extractSeverity;
    private generateTags;
    /**
     * Get the context manager for advanced usage
     */
    getContextManager(): ContextManager;
}
