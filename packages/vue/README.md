# @oluso/vue

AI-powered error monitoring for Vue 3 applications: automatic error reporting, breadcrumb tracking, and intelligent error grouping in the browser.

## Installation

```bash
npm install @oluso/vue
```

Requires Vue 3 (`>=3.0.0`). Vue 2 isn't supported — the plugin API and `app.config.errorHandler` this integration relies on are Vue 3-only.

## Features

- **Global Capture**: Wires into `app.config.errorHandler` to catch errors from anywhere in the component tree, and into `window.onerror`/`unhandledrejection` for everything else.
- **Breadcrumbs**: Tracks events leading to an error for better debugging.
- **User Context**: Tie errors to specific users.
- **Deduplication**: Intelligent fingerprinting groups similar errors together.
- **Offline Reliability**: Queues reports to `localStorage` when the network is unreachable, and retries on the next successful send.

## Usage

```ts
import { createApp } from 'vue';
import { OlusoVuePlugin } from '@oluso/vue';
import App from './App.vue';

createApp(App)
  .use(OlusoVuePlugin, { apiKey: 'your-api-key', environment: 'production' })
  .mount('#app');
```

Errors thrown anywhere in the component tree (render, `setup()`, lifecycle hooks) are caught and reported automatically — no wrapping components required. If you'd already set `app.config.errorHandler` yourself, `OlusoVuePlugin` preserves it and calls it after reporting.

## Manual Reporting & Context

Use the `useOluso()` composable from `setup()`:

```vue
<script setup>
import { useOluso } from '@oluso/vue';

const oluso = useOluso();

async function checkout() {
  oluso.addBreadcrumb({ message: 'User started checkout', category: 'action' });

  try {
    await doCheckout();
  } catch (error) {
    oluso.captureException(error, { step: 'checkout' });
  }
}
</script>
```

Outside `setup()` (e.g. in the Options API), the plugin also registers a global `$oluso` property:

```js
export default {
  methods: {
    async checkout() {
      try {
        await doCheckout();
      } catch (error) {
        this.$oluso.captureException(error, { step: 'checkout' });
      }
    },
  },
};
```

## Advanced Configuration

```ts
app.use(OlusoVuePlugin, {
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
