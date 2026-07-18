import {
  ErrorContext,
  ErrorReport,
  RateLimiter,
  Sanitizer,
  UserContext,
  generateFingerprint,
} from '@oluso/core';
import { sendErrorReport } from './transport';
import { OfflineQueue } from './queue';
import { NextjsContextManager } from './context';
import { getRuntimeServerContext } from './runtime';
import { OlusoNextjsOptions, RequestContext } from './types';

const DEFAULT_ENDPOINT = 'https://api.oluso.dev/api/v1/error/report';

/**
 * Server-side Oluso client for Next.js. Unlike @oluso/node's `Oluso`, this
 * has no dependency on Node's `http`/`https`/`os` modules or on
 * `process.on(...)` at construction time -- it works unchanged on both the
 * Node.js and Edge runtimes Next.js can run route handlers, middleware, and
 * Server Components on. For Client Components, use the browser-backed
 * pieces exported from `@oluso/nextjs/client` instead.
 */
export class Oluso {
  private options: OlusoNextjsOptions;
  private endpoint: string;
  private contextManager: NextjsContextManager;
  private sanitizer: Sanitizer;
  private rateLimiter: RateLimiter;
  private offlineQueue: OfflineQueue;

  constructor(options: OlusoNextjsOptions) {
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
    this.contextManager = new NextjsContextManager(this.options.maxBreadcrumbs);
    this.sanitizer = new Sanitizer(this.options.sensitiveKeys);
    this.rateLimiter = new RateLimiter(this.options.maxErrorsPerMinute);
    this.offlineQueue = new OfflineQueue(this.options.maxQueueSize);
  }

  /**
   * Runs `callback` inside a fresh request-scoped context. Route/middleware
   * wrappers in this package call this once per request; call it yourself
   * if you're reporting from somewhere those wrappers don't cover.
   */
  runInContext<T>(callback: () => T): T {
    return this.contextManager.run(callback);
  }

  addBreadcrumb(breadcrumb: Parameters<NextjsContextManager['addBreadcrumb']>[0]): void {
    this.contextManager.addBreadcrumb(breadcrumb);
  }

  setUserContext(user: UserContext): void {
    this.contextManager.setUserContext(user);
  }

  setCustomContext(key: string, value: any): void {
    this.contextManager.setCustomContext(key, value);
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

  reportError(error: Error, request?: RequestContext): Promise<void> {
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

    const context = this.buildErrorContext(request);

    const fingerprint = this.options.fingerprint
      ? this.options.fingerprint(error, context)
      : generateFingerprint(error, context);

    const report: ErrorReport = {
      title: this.generateErrorTitle(error),
      message: error.message,
      stack_trace: error.stack,
      environment: this.options.environment,
      severity: (error as any).severity || this.options.defaultSeverity || 'medium',
      tags: this.options.tags || [],
      fingerprint,
      context,
      timestamp: Date.now(),
    };

    return this.sendReport(report);
  }

  private buildErrorContext(request?: RequestContext): ErrorContext {
    const managed = this.contextManager.getContext();

    return {
      ...managed,
      custom: {
        ...managed.custom,
        server: getRuntimeServerContext(),
        ...(request ? { request: this.sanitizeRequest(request) } : {}),
      },
    };
  }

  private sanitizeRequest(request: RequestContext): RequestContext {
    return {
      ...request,
      headers: request.headers ? this.sanitizer.sanitizeHeaders(request.headers) : undefined,
      query: request.query ? this.sanitizer.sanitizeQuery(request.query) : undefined,
      body: request.body !== undefined ? this.sanitizer.sanitizeBody(request.body) : undefined,
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
}

export default Oluso;
