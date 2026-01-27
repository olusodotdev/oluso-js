import { ServerContext } from '../types';
/**
 * Get server context information
 */
export declare function getServerContext(): ServerContext;
/**
 * Rate limiter to prevent flooding the API
 */
export declare class RateLimiter {
    private timestamps;
    private maxPerMinute;
    constructor(maxPerMinute?: number);
    /**
     * Check if we can send another error report
     */
    canSend(): boolean;
    /**
     * Get the number of errors sent in the last minute
     */
    getCount(): number;
    /**
     * Reset the rate limiter
     */
    reset(): void;
}
declare const _default: {
    getServerContext: typeof getServerContext;
    RateLimiter: typeof RateLimiter;
};
export default _default;
