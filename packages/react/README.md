# @oluso/react

AI-powered error monitoring for React applications: automatic error reporting, breadcrumb tracking, and intelligent error grouping in the browser.

## Installation

```bash
npm install @oluso/react
```

## Features

- **Error Boundary**: Catches render-time errors in a subtree and reports them automatically.
- **Global Capture**: Catches uncaught exceptions and unhandled promise rejections anywhere in the app.
- **Breadcrumbs**: Tracks events leading to an error for better debugging.
- **User Context**: Tie errors to specific users.
- **Deduplication**: Intelligent fingerprinting groups similar errors together.
- **Offline Reliability**: Queues reports to `localStorage` when the network is unreachable, and retries on the next successful send.
- **SSR-safe**: No-ops gracefully outside a browser environment (e.g. during Next.js server rendering).

## Usage

Wrap your app in `OlusoProvider`, then use `ErrorBoundary` around any subtree you want to protect:

```tsx
import { OlusoProvider, ErrorBoundary, useOluso } from '@oluso/react';

function App() {
  return (
    <OlusoProvider options={{ apiKey: 'your-api-key', environment: 'production' }}>
      <Dashboard />
    </OlusoProvider>
  );
}

function Dashboard() {
  const oluso = useOluso();

  return (
    <ErrorBoundary client={oluso} fallback={<p>Something went wrong.</p>}>
      <Widgets />
    </ErrorBoundary>
  );
}
```

> Note: like all React error boundaries, `ErrorBoundary` only catches errors thrown during rendering, in lifecycle methods, and in constructors — not in event handlers or async code. Use `useOluso().captureException()` for those.

## Manual Reporting & Context

```tsx
import { useOluso } from '@oluso/react';

function CheckoutButton() {
  const oluso = useOluso();

  const handleClick = async () => {
    oluso.addBreadcrumb({ message: 'User started checkout', category: 'action' });

    try {
      await checkout();
    } catch (error) {
      oluso.captureException(error as Error, { step: 'checkout' });
    }
  };

  return <button onClick={handleClick}>Checkout</button>;
}
```

You can also use `OlusoClient` directly without React, e.g. from a service worker or non-component module:

```ts
import { OlusoClient } from '@oluso/react';

const oluso = new OlusoClient({ apiKey: 'your-api-key' });
oluso.setUserContext({ id: 'user_456', email: 'user@example.com' });
```

## Advanced Configuration

```ts
new OlusoClient({
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
