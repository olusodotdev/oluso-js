import { EnvironmentProviders, ErrorHandler, makeEnvironmentProviders } from '@angular/core';
import { OlusoBrowserOptions, OlusoClient } from '@oluso/browser';
import { OLUSO_CLIENT, OLUSO_OPTIONS } from './tokens.js';
import { OlusoErrorHandler } from './error-handler.js';

/**
 * Wires Oluso into a standalone Angular app:
 *
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [provideOluso({ apiKey: 'your-api-key' })],
 * });
 * ```
 *
 * Registers OlusoClient for DI (via `injectOluso()` or the OLUSO_CLIENT
 * token) and replaces Angular's `ErrorHandler` so every error Angular
 * catches gets reported automatically.
 */
export function provideOluso(options: OlusoBrowserOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: OLUSO_OPTIONS, useValue: options },
    { provide: OLUSO_CLIENT, useFactory: () => new OlusoClient(options) },
    { provide: ErrorHandler, useClass: OlusoErrorHandler },
  ]);
}
