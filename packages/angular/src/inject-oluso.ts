import { inject } from '@angular/core';
import { OlusoClient } from '@oluso/browser';
import { OLUSO_CLIENT } from './tokens.js';

/**
 * Access the OlusoClient registered by `provideOluso()`/`OlusoModule.forRoot()`,
 * for manual breadcrumb tracking, user context, and error capture. Must be
 * called from an injection context (a constructor, field initializer, or
 * factory function) — the same rule as Angular's own `inject()`.
 */
export function injectOluso(): OlusoClient {
  return inject(OLUSO_CLIENT);
}
