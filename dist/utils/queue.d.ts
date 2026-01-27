import { ErrorReport } from '../types';
interface QueuedReport {
    report: ErrorReport;
    timestamp: number;
    retries: number;
}
export declare class OfflineQueue {
    private queue;
    private maxSize;
    private queueFilePath;
    private isProcessing;
    constructor(maxSize?: number, queueDir?: string);
    /**
     * Add a report to the queue
     */
    enqueue(report: ErrorReport): void;
    /**
     * Get the next report to send
     */
    dequeue(): QueuedReport | undefined;
    /**
     * Peek at the next report without removing it
     */
    peek(): QueuedReport | undefined;
    /**
     * Re-add a failed report to the queue
     */
    requeueFailed(queuedReport: QueuedReport): void;
    /**
     * Get queue size
     */
    size(): number;
    /**
     * Check if queue is empty
     */
    isEmpty(): boolean;
    /**
     * Clear the queue
     */
    clear(): void;
    /**
     * Load queue from disk
     */
    private loadQueue;
    /**
     * Save queue to disk
     */
    private saveQueue;
    /**
     * Process the queue with a send function
     */
    processQueue(sendFn: (report: ErrorReport) => Promise<void>): Promise<void>;
}
export default OfflineQueue;
