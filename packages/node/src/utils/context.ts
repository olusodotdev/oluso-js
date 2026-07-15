import { AsyncLocalStorage } from 'async_hooks';
import { Breadcrumb, UserContext, ErrorContext } from '../types';

interface ContextData {
    breadcrumbs: Breadcrumb[];
    userContext?: UserContext;
    customContext: Record<string, any>;
    requestStartTime?: number;
}

class ContextManager {
    private storage: AsyncLocalStorage<ContextData>;
    private maxBreadcrumbs: number;

    constructor(maxBreadcrumbs: number = 30) {
        this.storage = new AsyncLocalStorage<ContextData>();
        this.maxBreadcrumbs = maxBreadcrumbs;
    }

    /**
     * Run a function with a new context
     */
    run<T>(callback: () => T): T {
        const contextData: ContextData = {
            breadcrumbs: [],
            customContext: {},
        };
        return this.storage.run(contextData, callback);
    }

    /**
     * Add a breadcrumb to the current context
     */
    addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
        const store = this.storage.getStore();
        if (!store) return;

        const fullBreadcrumb: Breadcrumb = {
            ...breadcrumb,
            timestamp: Date.now(),
        };

        store.breadcrumbs.push(fullBreadcrumb);

        // Keep only the last N breadcrumbs
        if (store.breadcrumbs.length > this.maxBreadcrumbs) {
            store.breadcrumbs.shift();
        }
    }

    /**
     * Set user context for the current request
     */
    setUserContext(user: UserContext): void {
        const store = this.storage.getStore();
        if (!store) return;
        store.userContext = user;
    }

    /**
     * Set custom context data
     */
    setCustomContext(key: string, value: any): void {
        const store = this.storage.getStore();
        if (!store) return;
        store.customContext[key] = value;
    }

    /**
     * Set request start time for response time tracking
     */
    setRequestStartTime(time: number): void {
        const store = this.storage.getStore();
        if (!store) return;
        store.requestStartTime = time;
    }

    /**
     * Get request start time
     */
    getRequestStartTime(): number | undefined {
        const store = this.storage.getStore();
        return store?.requestStartTime;
    }

    /**
     * Get all breadcrumbs from the current context
     */
    getBreadcrumbs(): Breadcrumb[] {
        const store = this.storage.getStore();
        return store?.breadcrumbs || [];
    }

    /**
     * Get user context from the current context
     */
    getUserContext(): UserContext | undefined {
        const store = this.storage.getStore();
        return store?.userContext;
    }

    /**
     * Get custom context from the current context
     */
    getCustomContext(): Record<string, any> {
        const store = this.storage.getStore();
        return store?.customContext || {};
    }

    /**
     * Get all context data
     */
    getContext(): Partial<ErrorContext> {
        const store = this.storage.getStore();
        if (!store) return {};

        return {
            breadcrumbs: store.breadcrumbs,
            user: store.userContext,
            custom: store.customContext,
        };
    }

    /**
     * Clear all context data
     */
    clear(): void {
        const store = this.storage.getStore();
        if (!store) return;

        store.breadcrumbs = [];
        store.userContext = undefined;
        store.customContext = {};
        store.requestStartTime = undefined;
    }
}

export default ContextManager;
