"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
exports.getServerContext = getServerContext;
const os_1 = __importDefault(require("os"));
/**
 * Get server context information
 */
function getServerContext() {
    const memUsage = process.memoryUsage();
    return {
        hostname: os_1.default.hostname(),
        platform: `${os_1.default.platform()} ${os_1.default.release()}`,
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
class RateLimiter {
    constructor(maxPerMinute = 60) {
        this.timestamps = [];
        this.maxPerMinute = maxPerMinute;
    }
    /**
     * Check if we can send another error report
     */
    canSend() {
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
    getCount() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        this.timestamps = this.timestamps.filter((ts) => ts > oneMinuteAgo);
        return this.timestamps.length;
    }
    /**
     * Reset the rate limiter
     */
    reset() {
        this.timestamps = [];
    }
}
exports.RateLimiter = RateLimiter;
exports.default = { getServerContext, RateLimiter };
