import { ErrorReport } from '@oluso/core';

interface QueuedReport {
    report: ErrorReport;
    timestamp: number;
    retries: number;
}

const STORAGE_KEY = 'oluso-queue';

function hasLocalStorage(): boolean {
    try {
        return typeof window !== 'undefined' && !!window.localStorage;
    } catch {
        return false;
    }
}

export class OfflineQueue {
    private queue: QueuedReport[] = [];
    private maxSize: number;
    private isProcessing: boolean = false;

    constructor(maxSize: number = 100) {
        this.maxSize = maxSize;
        this.loadQueue();
    }

    /**
     * Add a report to the queue
     */
    enqueue(report: ErrorReport): void {
        const queuedReport: QueuedReport = {
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
    dequeue(): QueuedReport | undefined {
        return this.queue.shift();
    }

    /**
     * Peek at the next report without removing it
     */
    peek(): QueuedReport | undefined {
        return this.queue[0];
    }

    /**
     * Re-add a failed report to the queue
     */
    requeueFailed(queuedReport: QueuedReport): void {
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
    size(): number {
        return this.queue.length;
    }

    /**
     * Check if queue is empty
     */
    isEmpty(): boolean {
        return this.queue.length === 0;
    }

    /**
     * Clear the queue
     */
    clear(): void {
        this.queue = [];
        this.saveQueue();
    }

    /**
     * Load queue from localStorage
     */
    private loadQueue(): void {
        if (!hasLocalStorage()) return;

        try {
            const data = window.localStorage.getItem(STORAGE_KEY);
            if (data) {
                this.queue = JSON.parse(data);

                // Remove old reports (older than 24 hours)
                const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                this.queue = this.queue.filter((item) => item.timestamp > oneDayAgo);
            }
        } catch (err) {
            // Silently fail and start with empty queue
            this.queue = [];
        }
    }

    /**
     * Save queue to localStorage
     */
    private saveQueue(): void {
        if (!hasLocalStorage()) return;

        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
        } catch (err) {
            // Silently fail (e.g. storage quota exceeded)
        }
    }

    /**
     * Process the queue with a send function
     */
    async processQueue(
        sendFn: (report: ErrorReport) => Promise<void>
    ): Promise<void> {
        if (this.isProcessing || this.isEmpty()) {
            return;
        }

        this.isProcessing = true;

        try {
            while (!this.isEmpty()) {
                const queuedReport = this.peek();
                if (!queuedReport) break;

                try {
                    await sendFn(queuedReport.report);
                    this.dequeue(); // Remove on success
                    this.saveQueue();
                } catch (err) {
                    // Failed to send, requeue with retry count
                    const failed = this.dequeue();
                    if (failed) {
                        this.requeueFailed(failed);
                    }
                    break; // Stop processing on failure
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }
}

export default OfflineQueue;
