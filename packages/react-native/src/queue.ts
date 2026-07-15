import { ErrorReport } from '@oluso/core';

interface QueuedReport {
    report: ErrorReport;
    timestamp: number;
    retries: number;
}

const STORAGE_KEY = '@oluso/queue';

/**
 * Lazily resolve AsyncStorage via `require` (rather than a static import) so
 * this package works without `@react-native-async-storage/async-storage`
 * installed — Metro still statically bundles the string-literal require,
 * this just tolerates it not being available at runtime.
 */
function getAsyncStorage(): { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> } | undefined {
    try {
        return require('@react-native-async-storage/async-storage').default;
    } catch {
        return undefined;
    }
}

export class OfflineQueue {
    private queue: QueuedReport[] = [];
    private maxSize: number;
    private isProcessing: boolean = false;
    private storage = getAsyncStorage();
    /** Resolves once any previously-persisted queue has been merged into memory */
    private ready: Promise<void>;

    constructor(maxSize: number = 100) {
        this.maxSize = maxSize;
        this.ready = this.loadQueue();
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
     * Load queue from AsyncStorage
     */
    private async loadQueue(): Promise<void> {
        if (!this.storage) return;

        try {
            const data = await this.storage.getItem(STORAGE_KEY);
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
     * Persist the queue to AsyncStorage. Writes are chained after `ready` so
     * a write triggered before the initial load resolves can't clobber
     * previously-persisted reports with an incomplete in-memory snapshot —
     * `this.queue` is read when the write actually runs, by which point the
     * load has already merged in anything from a previous session.
     */
    private saveQueue(): void {
        if (!this.storage) return;

        this.ready = this.ready
            .then(() => this.storage!.setItem(STORAGE_KEY, JSON.stringify(this.queue)))
            .catch(() => {
                // Silently fail
            });
    }

    /**
     * Process the queue with a send function
     */
    async processQueue(
        sendFn: (report: ErrorReport) => Promise<void>
    ): Promise<void> {
        await this.ready;

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
