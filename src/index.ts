import { CryerOptions, ErrorReport, Breadcrumb, UserContext, ErrorContext } from './types';
import { sendErrorReport } from './utils/https';
import ContextManager from './utils/context';
import Sanitizer from './utils/sanitizer';
import generateFingerprint from './utils/fingerprint';
import { getServerContext, RateLimiter } from './utils/server';
import OfflineQueue from './utils/queue';

export * from './types';
export * from './adapters/express';
export * from './adapters/nest';

export class Cryer {
  private options: CryerOptions;
  private reportUrl = 'https://crier-test.onrender.com/api/v1/error/report';
  private contextManager: ContextManager;
  private sanitizer: Sanitizer;
  private rateLimiter: RateLimiter;
  private offlineQueue: OfflineQueue;
  private globalHandlersRegistered = false;

  constructor(options: CryerOptions) {
    // Set default options
    this.options = {
      logToConsole: true,
      timeout: 5000,
      environment: 'development',
      defaultSeverity: 'medium',
      maxBreadcrumbs: 30,
      enableSourceMaps: false,
      enableOfflineQueue: true,
      maxQueueSize: 100,
      maxErrorsPerMinute: 60,
      includeRequestBody: true,
      includeRequestHeaders: true,
      ...options
    };

    // Initialize utilities
    this.contextManager = new ContextManager(this.options.maxBreadcrumbs);
    this.sanitizer = new Sanitizer(this.options.sensitiveKeys);
    this.rateLimiter = new RateLimiter(this.options.maxErrorsPerMinute);
    this.offlineQueue = new OfflineQueue(this.options.maxQueueSize);

    // Register global uncaught exception handler
    this.registerGlobalHandlers();
  }

  private registerGlobalHandlers() {
    if (this.globalHandlersRegistered) return;
    this.globalHandlersRegistered = true;

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.addBreadcrumb({
        message: 'Uncaught exception occurred',
        level: 'error',
        category: 'error',
      });
      this.reportError(error);
    });

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      this.addBreadcrumb({
        message: 'Unhandled promise rejection',
        level: 'error',
        category: 'promise',
      });

      if (reason instanceof Error) {
        this.reportError(reason);
      } else {
        this.reportError(new Error(`Unhandled rejection: ${String(reason)}`));
      }
    });

    // Warning events
    process.on('warning', (warning) => {
      this.addBreadcrumb({
        message: `Process warning: ${warning.name}`,
        level: 'warning',
        category: 'warning',
        data: {
          name: warning.name,
          message: warning.message,
        },
      });
    });

    // Handle worker thread errors if in worker context
    if (typeof (process as any).on === 'function') {
      try {
        const worker_threads = require('worker_threads');
        if (worker_threads.parentPort) {
          worker_threads.parentPort.on('error', (error: Error) => {
            this.addBreadcrumb({
              message: 'Worker thread error',
              level: 'error',
              category: 'worker',
            });
            this.reportError(error);
          });
        }
      } catch (err) {
        // worker_threads not available, skip
      }
    }

    // Handle cluster worker errors
    try {
      const cluster = require('cluster');
      if (cluster.isWorker) {
        process.on('disconnect', () => {
          this.addBreadcrumb({
            message: 'Cluster worker disconnected',
            level: 'warning',
            category: 'cluster',
          });
        });
      }
    } catch (err) {
      // cluster not available, skip
    }
  }

  /**
   * Add a breadcrumb to track events leading to errors
   */
  public addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    this.contextManager.addBreadcrumb(breadcrumb);
  }

  /**
   * Set user context for error reports
   */
  public setUserContext(user: UserContext): void {
    this.contextManager.setUserContext(user);
  }

  /**
   * Set custom context data
   */
  public setCustomContext(key: string, value: any): void {
    this.contextManager.setCustomContext(key, value);
  }

  /**
   * Capture and report an error with optional context
   */
  public captureException(error: Error, customContext?: Record<string, any>): Promise<void> {
    if (customContext) {
      for (const [key, value] of Object.entries(customContext)) {
        this.setCustomContext(key, value);
      }
    }
    return this.reportError(error);
  }

  /**
   * Flush all queued errors
   */
  public async flush(): Promise<void> {
    await this.offlineQueue.processQueue((report) =>
      sendErrorReport(this.reportUrl, report, {
        apiKey: this.options.apiKey,
        timeout: this.options.timeout
      })
    );
  }

  /**
   * Report an error to the API
   */
  public reportError(error: Error, req?: any, res?: any): Promise<void> {
    // Check if we should report this error
    if (this.options.shouldReport && !this.options.shouldReport(error, req, res)) {
      return Promise.resolve();
    }

    // Check rate limit
    if (!this.rateLimiter.canSend()) {
      if (this.options.logToConsole) {
        console.warn('[Cryer] Rate limit exceeded, error not reported');
      }
      return Promise.resolve();
    }

    // Log to console if enabled
    if (this.options.logToConsole) {
      console.error('[Cryer]', error);
    }

    // Build error context
    const context = this.buildErrorContext(req, res);

    // Generate fingerprint
    const fingerprint = this.options.fingerprint
      ? this.options.fingerprint(error, context)
      : generateFingerprint(error, context);

    // Extract a short title from the error message
    const title = this.generateErrorTitle(error);

    // Prepare error report
    const report: ErrorReport = {
      title: title,
      message: error.message,
      stack_trace: error.stack,
      environment: this.options.environment,
      severity: this.extractSeverity(error, res),
      tags: this.generateTags(error, req),
      fingerprint: fingerprint,
      context: context,
      timestamp: Date.now(),
    };

    // Send the report
    return this.sendReport(report);
  }

  /**
   * Build error context from request and stored context
   */
  private buildErrorContext(req?: any, res?: any): ErrorContext {
    const context: ErrorContext = {
      server: getServerContext(),
      ...this.contextManager.getContext(),
    };

    // Add request context if available
    if (req) {
      const requestStartTime = this.contextManager.getRequestStartTime();
      const responseTime = requestStartTime
        ? Date.now() - requestStartTime
        : undefined;

      context.request = {
        url: req.url || req.path || req.originalUrl || '',
        method: req.method || '',
        headers: this.options.includeRequestHeaders
          ? this.sanitizer.sanitizeHeaders(req.headers || {})
          : undefined,
        query: req.query ? this.sanitizer.sanitizeQuery(req.query) : undefined,
        body: this.options.includeRequestBody && req.body
          ? this.sanitizer.sanitizeBody(req.body)
          : undefined,
        params: req.params ? this.sanitizer.sanitizeObject(req.params) : undefined,
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers?.['user-agent'],
        responseTime,
      };
    }

    return context;
  }

  /**
   * Send error report to API or queue if offline
   */
  private async sendReport(report: ErrorReport): Promise<void> {
    try {
      await sendErrorReport(this.reportUrl, report, {
        apiKey: this.options.apiKey,
        timeout: this.options.timeout
      });

      // If successful and queue is enabled, try to process queued errors
      if (this.options.enableOfflineQueue && !this.offlineQueue.isEmpty()) {
        this.offlineQueue.processQueue((queuedReport) =>
          sendErrorReport(this.reportUrl, queuedReport, {
            apiKey: this.options.apiKey,
            timeout: this.options.timeout
          })
        ).catch(() => {
          // Silently fail queue processing
        });
      }
    } catch (err) {
      // If sending failed and offline queue is enabled, queue the report
      if (this.options.enableOfflineQueue) {
        this.offlineQueue.enqueue(report);
      }
    }
  }

  private generateErrorTitle(error: Error): string {
    // Extract the first line of the error message or use the constructor name
    const firstLine = error.message.split('\n')[0].trim();
    if (firstLine && firstLine.length > 0) {
      // Limit title length
      return firstLine.length <= 100 ? firstLine : `${firstLine.substring(0, 97)}...`;
    }
    return `${error.constructor.name} Error`;
  }

  private extractSeverity(error: Error, res?: any): string {
    // Check if severity is explicitly set on the error
    if ((error as any).severity) {
      return (error as any).severity;
    }

    // Determine severity based on status code if available
    if (res && res.statusCode) {
      if (res.statusCode >= 500) return 'critical';
      if (res.statusCode >= 400) return 'high';
    }

    // Use default severity
    return this.options.defaultSeverity || 'medium';
  }

  private generateTags(error: Error, req?: any): string[] {
    const tags = [...(this.options.tags || [])];

    // Add error type as tag
    tags.push(error.constructor.name);

    // Add route as tag if available
    if (req && req.route && req.route.path) {
      tags.push(`route:${req.route.path}`);
    }

    // Add HTTP method as tag if available
    if (req && req.method) {
      tags.push(`method:${req.method.toLowerCase()}`);
    }

    // Extract status code tag if available
    if (req && req.res && req.res.statusCode) {
      tags.push(`status:${req.res.statusCode}`);
    }

    return tags;
  }

  /**
   * Get the context manager for advanced usage
   */
  public getContextManager(): ContextManager {
    return this.contextManager;
  }
}