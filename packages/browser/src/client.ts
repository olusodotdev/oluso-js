import {
  BaseOlusoOptions,
  BreadcrumbManager,
  ErrorContext,
  ErrorReport,
  RateLimiter,
  Sanitizer,
  UserContext,
  generateFingerprint,
} from '@oluso/core';
import { sendErrorReport } from './transport';
import { OfflineQueue } from './queue';
import { getBrowserContext } from './browser-context';

const DEFAULT_ENDPOINT = 'https://api.oluso.dev/api/v1/error/report';

export interface OlusoBrowserOptions extends BaseOlusoOptions {}

/**
 * Browser-side counterpart to the Node `Oluso` class. Captures errors via
 * `window`'s global error hooks instead of `process`, sends reports with
 * `fetch` instead of Node's `http`/`https` modules, and persists the offline
 * queue to `localStorage` instead of disk.
 *
 * Framework-agnostic — used directly by @oluso/react and @oluso/vue, since
 * there's no meaningful platform difference between "React in a browser" and
 * "Vue in a browser".
 */
export class OlusoClient {
  private options: OlusoBrowserOptions;
  private endpoint: string;
  private breadcrumbs: BreadcrumbManager;
  private sanitizer: Sanitizer;
  private rateLimiter: RateLimiter;
  private offlineQueue: OfflineQueue;
  private globalHandlersRegistered = false;

  constructor(options: OlusoBrowserOptions) {
    this.options = {
      logToConsole: true,
      timeout: 5000,
      environment: 'production',
      defaultSeverity: 'medium',
      maxBreadcrumbs: 30,
      enableOfflineQueue: true,
      maxQueueSize: 100,
      maxErrorsPerMinute: 60,
      ...options,
    };

    this.endpoint = this.options.endpoint || DEFAULT_ENDPOINT;
    this.breadcrumbs = new BreadcrumbManager(this.options.maxBreadcrumbs);
    this.sanitizer = new Sanitizer(this.options.sensitiveKeys);
    this.rateLimiter = new RateLimiter(this.options.maxErrorsPerMinute);
    this.offlineQueue = new OfflineQueue(this.options.maxQueueSize);

    this.registerGlobalHandlers();
  }

  private registerGlobalHandlers(): void {
    if (this.globalHandlersRegistered) return;
    if (typeof window === 'undefined') return; // SSR: nothing to attach to
    this.globalHandlersRegistered = true;

    window.addEventListener('error', (event) => {
      if (!event.error) return;
      this.addBreadcrumb({
        message: 'Uncaught exception occurred',
        level: 'error',
        category: 'error',
      });
      this.reportError(event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.addBreadcrumb({
        message: 'Unhandled promise rejection',
        level: 'error',
        category: 'promise',
      });

      const reason = event.reason;
      if (reason instanceof Error) {
        this.reportError(reason);
      } else {
        this.reportError(new Error(`Unhandled rejection: ${String(reason)}`));
      }
    });
  }

  addBreadcrumb(breadcrumb: Parameters<BreadcrumbManager['addBreadcrumb']>[0]): void {
    this.breadcrumbs.addBreadcrumb(breadcrumb);
  }

  setUserContext(user: UserContext): void {
    this.breadcrumbs.setUserContext(user);
  }

  setCustomContext(key: string, value: any): void {
    this.breadcrumbs.setCustomContext(key, value);
  }

  captureException(error: Error, customContext?: Record<string, any>): Promise<void> {
    if (customContext) {
      for (const [key, value] of Object.entries(customContext)) {
        this.setCustomContext(key, value);
      }
    }
    return this.reportError(error);
  }

  async flush(): Promise<void> {
    await this.offlineQueue.processQueue((report) =>
      sendErrorReport(this.endpoint, report, {
        apiKey: this.options.apiKey,
        timeout: this.options.timeout,
      })
    );
  }

  reportError(error: Error): Promise<void> {
    if (this.options.shouldReport && !this.options.shouldReport(error)) {
      return Promise.resolve();
    }

    if (!this.rateLimiter.canSend()) {
      if (this.options.logToConsole) {
        console.warn('[Oluso] Rate limit exceeded, error not reported');
      }
      return Promise.resolve();
    }

    if (this.options.logToConsole) {
      console.error('[Oluso]', error);
    }

    const context = this.buildErrorContext();

    const fingerprint = this.options.fingerprint
      ? this.options.fingerprint(error, context)
      : generateFingerprint(error, context);

    const report: ErrorReport = {
      title: this.generateErrorTitle(error),
      message: error.message,
      stack_trace: error.stack,
      environment: this.options.environment,
      severity: this.options.defaultSeverity || 'medium',
      tags: this.options.tags || [],
      fingerprint,
      context,
      timestamp: Date.now(),
    };

    return this.sendReport(report);
  }

  private buildErrorContext(): ErrorContext {
    return {
      device: this.sanitizer.sanitizeObject(getBrowserContext()),
      ...this.breadcrumbs.getContext(),
    };
  }

  private async sendReport(report: ErrorReport): Promise<void> {
    try {
      await sendErrorReport(this.endpoint, report, {
        apiKey: this.options.apiKey,
        timeout: this.options.timeout,
      });

      if (this.options.enableOfflineQueue && !this.offlineQueue.isEmpty()) {
        this.offlineQueue
          .processQueue((queuedReport) =>
            sendErrorReport(this.endpoint, queuedReport, {
              apiKey: this.options.apiKey,
              timeout: this.options.timeout,
            })
          )
          .catch(() => {
            // Silently fail queue processing
          });
      }
    } catch (err) {
      if (this.options.enableOfflineQueue) {
        this.offlineQueue.enqueue(report);
      }
    }
  }

  private generateErrorTitle(error: Error): string {
    const firstLine = error.message.split('\n')[0].trim();
    if (firstLine && firstLine.length > 0) {
      return firstLine.length <= 100 ? firstLine : `${firstLine.substring(0, 97)}...`;
    }
    return `${error.constructor.name} Error`;
  }

  getBreadcrumbManager(): BreadcrumbManager {
    return this.breadcrumbs;
  }
}

export default OlusoClient;
