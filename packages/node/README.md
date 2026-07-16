# Oluso

AI-powered error monitoring library for Node.js applications with automatic error reporting, context tracking, and intelligent error grouping.

## Installation

```bash
npm install oluso
```

## Features

- **Framework Support**: Seamless integration with **Express** and **NestJS**.
- **Automatic Context**: Captures headers, body, query, and params (sanitized).
- **Breadcrumbs**: Tracks events leading to an error for better debugging.
- **User Context**: Tie errors to specific users.
- **Deduplication**: Intelligent fingerprinting groups similar errors together.
- **Offline Reliability**: Queues reports when the API is unreachable.
- **Global Capture**: Handles uncaught exceptions, unhandled rejections, and worker errors.
- **Rate Limiting**: Protects your API from being flooded by repetitive errors.

## Usage with Express

`olusoExpress()` returns two middlewares that must be mounted at different
points in your app -- Express dispatches request vs. error middleware based
on each function's parameter count, so one function can't do both jobs.

```typescript
import express from 'express';
import { olusoExpress } from 'oluso';

const app = express();
app.use(express.json());

const oluso = olusoExpress({
  apiKey: 'your-api-key',
  environment: 'production',
  sensitiveKeys: ['password', 'card_number'] // Optional custom sanitization
});

// requestHandler first, before your routes
app.use(oluso.requestHandler);

app.get('/api/test', (req, res) => {
  throw new Error('Something went wrong!');
});

// errorHandler last, after all your routes -- Express only routes an
// error to handlers registered after the route that produced it.
app.use(oluso.errorHandler);

app.listen(3000);
```

Note: Express 4 does not automatically forward a rejected promise from an
`async` route handler into error-handling middleware. For async routes,
either catch and call `next(err)` yourself, or use a wrapper like
`express-async-errors`/Express 5 -- otherwise a thrown/rejected error in an
async handler never reaches `oluso.errorHandler` at all.

### Cron jobs, queue workers, and other non-request code

`requestHandler`/`errorHandler` only see errors that pass through Express's
request/response cycle. A `node-cron`/BullMQ job, a `setInterval` loop, or a
message-queue consumer is invisible to both of them -- and invisible to
uncaught-exception reporting too, if that code catches its own errors (even
just to log them) rather than letting them throw. The object `olusoExpress()`
returns also exposes `captureException` (and `addBreadcrumb`/`setUserContext`/
`setCustomContext`/`flush`) on the same instance, for exactly this case:

```typescript
const oluso = olusoExpress({ apiKey: 'your-api-key' });

cron.schedule('0 21 * * *', async () => {
  try {
    await deleteStaleRecords();
  } catch (err) {
    oluso.captureException(err); // otherwise this failure is invisible
  }
});
```

## Usage with NestJS

Use the `OlusoExceptionFilter` to capture errors globally across HTTP, WebSockets, and RPC.

```typescript
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { OlusoExceptionFilter } from 'oluso';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: OlusoExceptionFilter({
        apiKey: 'your-api-key',
        environment: 'production',
        tags: ['nest-api']
      })
    }
  ]
})
export class AppModule {}
```

## Manual Reporting & Context

```typescript
import { Oluso } from 'oluso';

const oluso = new Oluso({ apiKey: 'your-api-key' });

// Add breadcrumbs for debugging trails
oluso.addBreadcrumb({
  message: 'User started checkout',
  category: 'action',
  data: { cartId: '123' }
});

// Set user context
oluso.setUserContext({
  id: 'user_456',
  email: 'user@example.com'
});

try {
  doWork();
} catch (error) {
  oluso.captureException(error, { custom_meta: 'extra-info' });
}
```

## Advanced Configuration

```typescript
const oluso = new Oluso({
  apiKey: 'your-api-key',
  environment: 'staging',
  defaultSeverity: 'medium',
  maxBreadcrumbs: 50,
  maxErrorsPerMinute: 100,
  enableOfflineQueue: true,
  sensitiveKeys: ['ssn', 'api_key'],
  shouldReport: (err, req) => {
    // Don't report 404s
    if (req?.res?.statusCode === 404) return false;
    return true;
  }
});
```

## Error Report Structure

Reports sent to the API include:

- **Metadata**: Title, message, stack trace, severity, tags.
- **Context**: Request details (URL, method, headers, etc.), Server details (hostname, node version, memory).
- **History**: Breadcrumbs leading up to the error.
- **Identification**: Fingerprint for deduplication and User ID.

## License

MIT
