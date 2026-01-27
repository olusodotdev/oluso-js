import { Breadcrumb, UserContext, ErrorContext } from '../types';
declare class ContextManager {
    private storage;
    private maxBreadcrumbs;
    constructor(maxBreadcrumbs?: number);
    /**
     * Run a function with a new context
     */
    run<T>(callback: () => T): T;
    /**
     * Add a breadcrumb to the current context
     */
    addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void;
    /**
     * Set user context for the current request
     */
    setUserContext(user: UserContext): void;
    /**
     * Set custom context data
     */
    setCustomContext(key: string, value: any): void;
    /**
     * Set request start time for response time tracking
     */
    setRequestStartTime(time: number): void;
    /**
     * Get request start time
     */
    getRequestStartTime(): number | undefined;
    /**
     * Get all breadcrumbs from the current context
     */
    getBreadcrumbs(): Breadcrumb[];
    /**
     * Get user context from the current context
     */
    getUserContext(): UserContext | undefined;
    /**
     * Get custom context from the current context
     */
    getCustomContext(): Record<string, any>;
    /**
     * Get all context data
     */
    getContext(): Partial<ErrorContext>;
    /**
     * Clear all context data
     */
    clear(): void;
}
export default ContextManager;
