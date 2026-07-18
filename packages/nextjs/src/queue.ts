import { ErrorReport } from '@oluso/core';

interface QueuedReport {
  report: ErrorReport;
  timestamp: number;
  retries: number;
}

/**
 * In-memory-only offline queue. Unlike @oluso/browser's queue, this has
 * nothing to persist to (no localStorage on the server, and no disk write
 * that would be safe to do implicitly on every request) -- it only smooths
 * over a send failure that gets retried by a *later* error in the same warm
 * process/instance. On serverless platforms where each invocation is a
 * fresh process, a queued report that never gets a follow-up error to
 * piggyback on is simply lost, same as it would be if reporting weren't
 * retried at all.
 */
export class OfflineQueue {
  private queue: QueuedReport[] = [];
  private maxSize: number;
  private isProcessing = false;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  enqueue(report: ErrorReport): void {
    this.queue.push({ report, timestamp: Date.now(), retries: 0 });
    if (this.queue.length > this.maxSize) {
      this.queue.shift();
    }
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  async processQueue(sendFn: (report: ErrorReport) => Promise<void>): Promise<void> {
    if (this.isProcessing || this.isEmpty()) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const queued = this.queue[0];

        try {
          await sendFn(queued.report);
          this.queue.shift();
        } catch {
          queued.retries++;
          if (queued.retries >= 3) {
            this.queue.shift();
          }
          break;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export default OfflineQueue;
