import { ErrorHandler, ModuleWithProviders, NgModule } from '@angular/core';
import { OlusoBrowserOptions, OlusoClient } from '@oluso/browser';
import { OLUSO_CLIENT, OLUSO_OPTIONS } from './tokens.js';
import { OlusoErrorHandler } from './error-handler.js';

/**
 * NgModule-style equivalent of `provideOluso()`, for apps that still
 * bootstrap via `AppModule` rather than `bootstrapApplication()`:
 *
 * ```ts
 * @NgModule({
 *   imports: [OlusoModule.forRoot({ apiKey: 'your-api-key' })],
 * })
 * export class AppModule {}
 * ```
 */
@NgModule({})
export class OlusoModule {
  static forRoot(options: OlusoBrowserOptions): ModuleWithProviders<OlusoModule> {
    return {
      ngModule: OlusoModule,
      providers: [
        { provide: OLUSO_OPTIONS, useValue: options },
        { provide: OLUSO_CLIENT, useFactory: () => new OlusoClient(options) },
        { provide: ErrorHandler, useClass: OlusoErrorHandler },
      ],
    };
  }
}
