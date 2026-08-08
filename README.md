# Oluso

AI-powered error monitoring for JavaScript and TypeScript applications — automatic error reporting, context tracking, and intelligent error grouping across backend and frontend.

This is a monorepo containing the Oluso SDKs:

| Package | Description |
| --- | --- |
| [`oluso`](packages/node) | Node.js SDK — Express and NestJS adapters, plus a framework-agnostic core |
| [`@oluso/react`](packages/react) | React SDK — error boundary, provider, and hook |
| [`@oluso/react-native`](packages/react-native) | React Native SDK — same API as `@oluso/react`, backed by `ErrorUtils` and `AsyncStorage` |
| [`@oluso/vue`](packages/vue) | Vue 3 SDK — plugin (`app.config.errorHandler`) and `useOluso()` composable |
| [`@oluso/angular`](packages/angular) | Angular SDK — `ErrorHandler`, DI providers, and an `injectOluso()` helper |
| [`@oluso/browser`](packages/browser) | Shared browser client (`OlusoClient`) used internally by `@oluso/react`, `@oluso/vue`, and `@oluso/angular` |
| [`@oluso/core`](packages/core) | Shared types and platform-agnostic utilities used internally by the SDKs above |

## Installation

```bash
# Node.js backend
npm install oluso

# React frontend
npm install @oluso/react

# React Native
npm install @oluso/react-native

# Vue frontend
npm install @oluso/vue

# Angular frontend
npm install @oluso/angular
```

See each package's README for usage.

## Monitor outcomes, heartbeats, and workflows

Create the corresponding monitor under **Project → Monitors**, then use the same client you already created for error reporting:

```ts
const oluso = new Oluso({ apiKey: process.env.OLUSO_API_KEY! });

// A heartbeat uses the monitor-specific secret HTTPS URL shown once at creation.
await oluso.heartbeat(process.env.OLUSO_BACKUP_HEARTBEAT_URL!, {
  context: { job: 'nightly-backup', rows: 12_402 },
});

// Assert a business result even when no exception was thrown.
await oluso.assertOutcome({
  monitor: 'checkout-total',
  passed: chargedAmount === expectedAmount,
  expected: expectedAmount,
  actual: chargedAmount,
  durationMs: Date.now() - startedAt,
  context: { orderId },
});

// Track an ordered process. A run ID is generated when omitted.
const deployment = oluso.workflow({ monitor: 'production-deployment' });
await deployment.checkpoint('queued', { commitSha });
await deployment.checkpoint('built', { artifact });
await deployment.checkpoint('deployed', { region: 'lon1' });
await deployment.complete({ release: artifact });
```

Use `{ monitorId: '...' }` instead of `{ monitor: '...' }` when you want an immutable reference. Evidence is recursively redacted and bounded. Monitor requests time out, retry transient network/408/429/5xx failures with exponential backoff, and never retry permanent 4xx responses. The project connection string is deliberately **not** attached to heartbeat URLs.

## Development

This repo uses npm workspaces.

```bash
npm install       # installs all packages
npm run build     # builds all packages
npm test          # tests all packages
```

## License

MIT
