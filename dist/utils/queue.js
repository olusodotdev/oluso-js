"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfflineQueue = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class OfflineQueue {
    constructor(maxSize = 100, queueDir) {
        this.queue = [];
        this.isProcessing = false;
        this.maxSize = maxSize;
        // Use temp directory for queue storage
        const tempDir = queueDir || path_1.default.join(require('os').tmpdir(), 'oluso-queue');
        if (!fs_1.default.existsSync(tempDir)) {
            try {
                fs_1.default.mkdirSync(tempDir, { recursive: true });
            }
            catch (err) {
                // Silently fail if we can't create the directory
            }
        }
        this.queueFilePath = path_1.default.join(tempDir, 'error-queue.json');
        this.loadQueue();
    }
    /**
     * Add a report to the queue
     */
    enqueue(report) {
        const queuedReport = {
            report,
            timestamp: Date.now(),
            retries: 0,
        };
        this.queue.push(queuedReport);
        // Keep queue size under limit
        if (this.queue.length > this.maxSize) {
            this.queue.shift(); // Remove oldest
        }
        this.saveQueue();
    }
    /**
     * Get the next report to send
     */
    dequeue() {
        return this.queue.shift();
    }
    /**
     * Peek at the next report without removing it
     */
    peek() {
        return this.queue[0];
    }
    /**
     * Re-add a failed report to the queue
     */
    requeueFailed(queuedReport) {
        queuedReport.retries++;
        // Only requeue if retries are below threshold
        if (queuedReport.retries < 3) {
            this.queue.unshift(queuedReport);
            this.saveQueue();
        }
    }
    /**
     * Get queue size
     */
    size() {
        return this.queue.length;
    }
    /**
     * Check if queue is empty
     */
    isEmpty() {
        return this.queue.length === 0;
    }
    /**
     * Clear the queue
     */
    clear() {
        this.queue = [];
        this.saveQueue();
    }
    /**
     * Load queue from disk
     */
    loadQueue() {
        try {
            if (fs_1.default.existsSync(this.queueFilePath)) {
                const data = fs_1.default.readFileSync(this.queueFilePath, 'utf-8');
                this.queue = JSON.parse(data);
                // Remove old reports (older than 24 hours)
                const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                this.queue = this.queue.filter((item) => item.timestamp > oneDayAgo);
            }
        }
        catch (err) {
            // Silently fail and start with empty queue
            this.queue = [];
        }
    }
    /**
     * Save queue to disk
     */
    saveQueue() {
        try {
            fs_1.default.writeFileSync(this.queueFilePath, JSON.stringify(this.queue, null, 2), 'utf-8');
        }
        catch (err) {
            // Silently fail
        }
    }
    /**
     * Process the queue with a send function
     */
    async processQueue(sendFn) {
        if (this.isProcessing || this.isEmpty()) {
            return;
        }
        this.isProcessing = true;
        try {
            while (!this.isEmpty()) {
                const queuedReport = this.peek();
                if (!queuedReport)
                    break;
                try {
                    await sendFn(queuedReport.report);
                    this.dequeue(); // Remove on success
                    this.saveQueue();
                }
                catch (err) {
                    // Failed to send, requeue with retry count
                    const failed = this.dequeue();
                    if (failed) {
                        this.requeueFailed(failed);
                    }
                    break; // Stop processing on failure
                }
            }
        }
        finally {
            this.isProcessing = false;
        }
    }
}
exports.OfflineQueue = OfflineQueue;
exports.default = OfflineQueue;
