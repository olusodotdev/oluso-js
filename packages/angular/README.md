# @oluso/angular

AI-powered error monitoring for Angular applications: automatic error reporting, breadcrumb tracking, and intelligent error grouping in the browser.

## Installation

```bash
npm install @oluso/angular
```

Requires Angular `>=15.0.0`. Ships as an ES module, matching modern Angular's own package format.

## Features

- **Global Capture**: Replaces Angular's `ErrorHandler`, so every error Angular catches (template bindings, lifecycle hooks, zone-wrapped RxJS subscriptions) is reported automatically. Also catches `window.onerror`/`unhandledrejection` for anything outside Angular's zone.
- **Breadcrumbs**: Tracks events leading to an error for better debugging.
- **User Context**: Tie errors to specific users.
- **Deduplication**: Intelligent fingerprinting groups similar errors together.
- **Offline Reliability**: Queues reports to `localStorage` when the network is unreachable, and retries on the next successful send.

## Usage (standalone apps)

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideOluso } from '@oluso/angular';
import { AppComponent } from './app.component';

bootstrapApplication(AppComponent, {
  providers: [provideOluso({ apiKey: 'your-api-key', environment: 'production' })],
});
```

## Usage (NgModule apps)

```ts
import { NgModule } from '@angular/core';
import { OlusoModule } from '@oluso/angular';

@NgModule({
  imports: [OlusoModule.forRoot({ apiKey: 'your-api-key', environment: 'production' })],
})
export class AppModule {}
```

Either way, errors anywhere in the component tree are caught and reported automatically — no wrapping components required.

## Manual Reporting & Context

```ts
import { Component } from '@angular/core';
import { injectOluso } from '@oluso/angular';

@Component({ selector: 'app-checkout', template: '...' })
export class CheckoutComponent {
  private oluso = injectOluso();

  async checkout() {
    this.oluso.addBreadcrumb({ message: 'User started checkout', category: 'action' });

    try {
      await this.doCheckout();
    } catch (error) {
      this.oluso.captureException(error as Error, { step: 'checkout' });
    }
  }
}
```

`injectOluso()` follows the same rule as Angular's own `inject()` — call it from a constructor, field initializer, or factory function.

## Advanced Configuration

```ts
provideOluso({
  apiKey: 'your-api-key',
  endpoint: 'https://api.oluso.dev/api/v1/error/report', // override for self-hosting
  environment: 'staging',
  defaultSeverity: 'medium',
  maxBreadcrumbs: 50,
  maxErrorsPerMinute: 100,
  enableOfflineQueue: true,
  sensitiveKeys: ['ssn', 'api_key'],
  shouldReport: (err) => !err.message.includes('ResizeObserver'),
});
```

## License

MIT
