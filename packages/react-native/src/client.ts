import {
  BaseOlusoOptions,
  BreadcrumbManager,
  ErrorContext,
  ErrorReport,
  RateLimiter,
  Sanitizer,
  UserContext,
  generateFingerprint,
  buildExceptionDetails,
  MonitorClient,
  MonitorWorkflow,
  type AssertionOptions,
  type HeartbeatOptions,
  type MonitorReceipt,
  type MonitorReference,
} from '@oluso/core';
import { PayloadTooLargeError, sendErrorReport } from './transport';
import { OfflineQueue } from './queue';
import { getDeviceContext } from './device-context';

const DEFAULT_ENDPOINT = 'https://api.oluso.dev/api/v1/error/report';

export interface OlusoReactNativeOptions extends BaseOlusoOptions {}

type ErrorUtilsHandler = (error: Error, isFatal?: boolean) => void;

interface ErrorUtilsShape {
  setGlobalHandler: (handler: ErrorUtilsHandler) => void;
  getGlobalHandler?: () => ErrorUtilsHandler;
}

// `ErrorUtils` is a global injected by the React Native JS runtime.
declare const ErrorUtils: ErrorUtilsShape | undefined;

/**
 * React Native counterpart to the Node `Oluso` class. Captures errors via
 * `ErrorUtils.setGlobalHandler` instead of `process` or `window`, sends
 * reports with `fetch`, and persists the offline queue to AsyncStorage
 * instead of disk or localStorage.
 */
export class OlusoClient {
  private options: OlusoReactNativeOptions;
  private endpoint: string;
  private breadcrumbs: BreadcrumbManager;
  private sanitizer: Sanitizer;
  private rateLimiter: RateLimiter;
  private offlineQueue: OfflineQueue;
  private globalHandlersRegistered = false;
  private monitorClient: MonitorClient;

  constructor(options: OlusoReactNativeOptions) {
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
    this.monitorClient = new MonitorClient({ apiKey: this.options.apiKey, endpoint: this.options.monitorEndpoint, timeout: this.options.timeout, retries: this.options.monitorRetries, sensitiveKeys: this.options.sensitiveKeys });

    this.registerGlobalHandlers();
  }

  private registerGlobalHandlers(): void {
    if (this.globalHandlersRegistered) return;
    if (typeof ErrorUtils === 'undefined') return; // not running under the RN JS runtime
    this.globalHandlersRegistered = true;

    const previousHandler = ErrorUtils.getGlobalHandler?.();

    ErrorUtils.setGlobalHandler((error, isFatal) => {
      this.addBreadcrumb({
        message: isFatal ? 'Fatal exception occurred' : 'Uncaught exception occurred',
        level: 'error',
        category: 'error',
        data: { isFatal: !!isFatal },
      });
      this.reportError(error);

      // Preserve React Native's default red-box / crash behavior
      previousHandler?.(error, isFatal);
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

  /** `customContext` applies to this report only; use setCustomContext for
   * context that should attach to every subsequent report. */
  captureException(error: Error, customContext?: Record<string, any>): Promise<void> {
    return this.reportError(error, customContext);
  }

  heartbeat(url: string, options?: HeartbeatOptions): Promise<MonitorReceipt> { return this.monitorClient.heartbeat(url, options); }
  assertOutcome(options: AssertionOptions): Promise<MonitorReceipt> { return this.monitorClient.assertOutcome(options); }
  workflow(reference: MonitorReference, runId?: string): MonitorWorkflow { return this.monitorClient.workflow(reference, runId); }

  async flush(): Promise<void> {
    await this.offlineQueue.processQueue((report) =>
      sendErrorReport(this.endpoint, report, {
        apiKey: this.options.apiKey,
        timeout: this.options.timeout,
        logToConsole: this.options.logToConsole,
      })
    );
  }

  reportError(error: Error, customContext?: Record<string, any>): Promise<void> {
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

    const context = this.buildErrorContext(customContext);

    const fingerprint = this.options.fingerprint
      ? this.options.fingerprint(error, context)
      : generateFingerprint(error, context);

    const report: ErrorReport = {
      schema_version: 2,
      title: this.generateErrorTitle(error),
      message: error.message,
      stack_trace: error.stack,
      environment: this.options.environment,
      severity: this.options.defaultSeverity || 'medium',
      tags: this.options.tags || [],
      fingerprint,
      context,
      timestamp: Date.now(),
      exception: buildExceptionDetails(error, this.sanitizer),
      sdk: { name: '@oluso/react-native', version: '1.1.0', language: 'javascript' }, // x-release-please-version
    };

    return this.sendReport(report);
  }

  private buildErrorContext(customContext?: Record<string, any>): ErrorContext {
    const context: ErrorContext = {
      device: this.sanitizer.sanitizeObject(getDeviceContext()),
      ...this.breadcrumbs.getContext(),
    };
    if (customContext) {
      context.custom = { ...context.custom, ...customContext };
    }
    return context;
  }

  private async sendReport(report: ErrorReport): Promise<void> {
    try {
      await sendErrorReport(this.endpoint, report, {
        apiKey: this.options.apiKey,
        timeout: this.options.timeout,
        logToConsole: this.options.logToConsole,
      });

      if (this.options.enableOfflineQueue && !this.offlineQueue.isEmpty()) {
        this.offlineQueue
          .processQueue((queuedReport) =>
            sendErrorReport(this.endpoint, queuedReport, {
              apiKey: this.options.apiKey,
              timeout: this.options.timeout,
              logToConsole: this.options.logToConsole,
            })
          )
          .catch(() => {
            // Silently fail queue processing
          });
      }
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        await this.sendTrimmedReport(report);
        return;
      }
      if (this.options.enableOfflineQueue) {
        this.offlineQueue.enqueue(report);
      }
    }
  }

  /**
   * A report can only exceed the transport's payload cap through what was
   * attached to it (breadcrumbs, custom context, device info) -- the error
   * itself is small. Retry once with the context stripped so the error
   * still reports, and never queue an oversized report: it would burn its
   * retries without ever being able to succeed.
   */
  private async sendTrimmedReport(report: ErrorReport): Promise<void> {
    const trimmed: ErrorReport = { ...report, context: {} };
    try {
      await sendErrorReport(this.endpoint, trimmed, {
        apiKey: this.options.apiKey,
        timeout: this.options.timeout,
        logToConsole: this.options.logToConsole,
      });
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        if (this.options.logToConsole) {
          console.warn('[Oluso] Report dropped: payload exceeds the size limit even with context stripped');
        }
        return;
      }
      if (this.options.enableOfflineQueue) {
        this.offlineQueue.enqueue(trimmed);
      }
    }
  }

  private generateErrorTitle(error: Error): string {
    const firstLine = error.message.split('\n')[0].trim();
    if (firstLine && firstLine.length > 0) {
      return firstLine.length <= 100 ? firstLine : `${firstLine.substring(0, 97)}...`;
    }
    return error.constructor.name || 'Error';
  }

  getBreadcrumbManager(): BreadcrumbManager {
    return this.breadcrumbs;
  }
}

export default OlusoClient;
