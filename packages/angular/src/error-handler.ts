import { ErrorHandler, Inject, Injectable } from '@angular/core';
import { OlusoClient } from '@oluso/browser';
import { OLUSO_CLIENT } from './tokens';

/**
 * Replaces Angular's default ErrorHandler. Angular routes every error it
 * catches (template bindings, lifecycle hooks, RxJS subscriptions inside
 * the zone, etc.) through a single `ErrorHandler.handleError()` call — there
 * is no per-handler chaining concept the way React's ErrorBoundary or Vue's
 * errorHandler have, so this *is* the whole integration point.
 *
 * `OlusoClient` already logs to the console itself (via `logToConsole`,
 * default on), so this doesn't duplicate Angular's default console.error
 * behavior — set `logToConsole: false` in options if you don't want that.
 */
@Injectable()
export class OlusoErrorHandler implements ErrorHandler {
  constructor(@Inject(OLUSO_CLIENT) private readonly client: OlusoClient) {}

  handleError(error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.client.captureException(normalized);
  }
}
