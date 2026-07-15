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

Inject Oluso as a single middleware. It handles both request tracking and global error catching.

```typescript
import express from 'express';
import { olusoExpress } from 'oluso';

const app = express();
app.use(express.json());

// Add Oluso middleware (early in the chain)
app.use(olusoExpress({
  apiKey: 'your-api-key',
  environment: 'production',
  sensitiveKeys: ['password', 'card_number'] // Optional custom sanitization
}));

app.get('/api/test', (req, res) => {
  throw new Error('Something went wrong!');
});

app.listen(3000);
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
