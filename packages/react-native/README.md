# @oluso/react-native

AI-powered error monitoring for React Native applications: automatic error reporting, breadcrumb tracking, and intelligent error grouping on-device.

## Installation

```bash
npm install @oluso/react-native
```

Optional, but recommended so queued reports survive app restarts:

```bash
npm install @react-native-async-storage/async-storage
```

## Features

- **Error Boundary**: Catches render-time errors in a subtree and reports them automatically.
- **Global Capture**: Catches uncaught JS exceptions and fatal errors via `ErrorUtils`, without disabling React Native's own red-box/crash handling.
- **Breadcrumbs**: Tracks events leading to an error for better debugging.
- **User Context**: Tie errors to specific users.
- **Deduplication**: Intelligent fingerprinting groups similar errors together.
- **Offline Reliability**: Queues reports (in `AsyncStorage`, when installed) when the network is unreachable, and retries on the next successful send. Without `AsyncStorage`, the queue still works for the current app session, it just doesn't survive a restart.

## Usage

Wrap your app in `OlusoProvider`, then use `ErrorBoundary` around any subtree you want to protect:

```tsx
import { OlusoProvider, ErrorBoundary, useOluso } from '@oluso/react-native';
import { Text, View } from 'react-native';

export default function App() {
  return (
    <OlusoProvider options={{ apiKey: 'your-api-key', environment: 'production' }}>
      <Dashboard />
    </OlusoProvider>
  );
}

function Dashboard() {
  const oluso = useOluso();

  return (
    <ErrorBoundary client={oluso} fallback={<Text>Something went wrong.</Text>}>
      <Widgets />
    </ErrorBoundary>
  );
}
```

> Note: like all React error boundaries, `ErrorBoundary` only catches errors thrown during rendering, in lifecycle methods, and in constructors — not in event handlers or async code. Those are still caught by the global `ErrorUtils` handler, or can be reported manually with `useOluso().captureException()`.

## Manual Reporting & Context

```tsx
import { useOluso } from '@oluso/react-native';

function CheckoutButton() {
  const oluso = useOluso();

  const handlePress = async () => {
    oluso.addBreadcrumb({ message: 'User started checkout', category: 'action' });

    try {
      await checkout();
    } catch (error) {
      oluso.captureException(error as Error, { step: 'checkout' });
    }
  };

  return <Button title="Checkout" onPress={handlePress} />;
}
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
  shouldReport: (err) => !err.message.includes('Failed to fetch'),
});
```

## License

MIT
