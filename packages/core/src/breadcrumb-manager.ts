import { Breadcrumb, UserContext, ErrorContext } from './types';

/**
 * Simple in-memory breadcrumb/context tracker for platforms without
 * per-request isolation (browser, React Native). Unlike Node's
 * AsyncLocalStorage-backed ContextManager, this tracks a single ongoing
 * session rather than scoping context to a request.
 */
export class BreadcrumbManager {
    private breadcrumbs: Breadcrumb[] = [];
    private userContext?: UserContext;
    private customContext: Record<string, any> = {};
    private maxBreadcrumbs: number;

    constructor(maxBreadcrumbs: number = 30) {
        this.maxBreadcrumbs = maxBreadcrumbs;
    }

    addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
        const fullBreadcrumb: Breadcrumb = {
            ...breadcrumb,
            timestamp: Date.now(),
        };

        this.breadcrumbs.push(fullBreadcrumb);

        if (this.breadcrumbs.length > this.maxBreadcrumbs) {
            this.breadcrumbs.shift();
        }
    }

    setUserContext(user: UserContext): void {
        this.userContext = user;
    }

    setCustomContext(key: string, value: any): void {
        this.customContext[key] = value;
    }

    getBreadcrumbs(): Breadcrumb[] {
        return this.breadcrumbs;
    }

    getUserContext(): UserContext | undefined {
        return this.userContext;
    }

    getCustomContext(): Record<string, any> {
        return this.customContext;
    }

    getContext(): Partial<ErrorContext> {
        return {
            breadcrumbs: this.breadcrumbs,
            user: this.userContext,
            custom: this.customContext,
        };
    }

    clear(): void {
        this.breadcrumbs = [];
        this.userContext = undefined;
        this.customContext = {};
    }
}

export default BreadcrumbManager;
