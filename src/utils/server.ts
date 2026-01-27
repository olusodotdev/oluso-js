import os from 'os';
import { ServerContext } from '../types';

/**
 * Get server context information
 */
export function getServerContext(): ServerContext {
    const memUsage = process.memoryUsage();

    return {
        hostname: os.hostname(),
        platform: `${os.platform()} ${os.release()}`,
        nodeVersion: process.version,
        processId: process.pid,
        memory: {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
        },
        uptime: process.uptime(),
    };
}

/**
 * Rate limiter to prevent flooding the API
 */
export class RateLimiter {
    private timestamps: number[] = [];
    private maxPerMinute: number;

    constructor(maxPerMinute: number = 60) {
        this.maxPerMinute = maxPerMinute;
    }

    /**
     * Check if we can send another error report
     */
    canSend(): boolean {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        // Remove timestamps older than 1 minute
        this.timestamps = this.timestamps.filter((ts) => ts > oneMinuteAgo);

        // Check if we're under the limit
        if (this.timestamps.length < this.maxPerMinute) {
            this.timestamps.push(now);
            return true;
        }

        return false;
    }

    /**
     * Get the number of errors sent in the last minute
     */
    getCount(): number {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        this.timestamps = this.timestamps.filter((ts) => ts > oneMinuteAgo);
        return this.timestamps.length;
    }

    /**
     * Reset the rate limiter
     */
    reset(): void {
        this.timestamps = [];
    }
}

export default { getServerContext, RateLimiter };
