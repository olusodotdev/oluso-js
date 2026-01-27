# Cryer

AI-powered error monitoring library for Node.js applications with automatic error reporting, context tracking, and intelligent error grouping.

## Installation

```bash
npm install cryer
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

Inject Cryer as a single middleware. It handles both request tracking and global error catching.

```typescript
import express from 'express';
import { cryerExpress } from 'cryer';

const app = express();
app.use(express.json());

// Add Cryer middleware (early in the chain)
app.use(cryerExpress({
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

Use the `CryerExceptionFilter` to capture errors globally across HTTP, WebSockets, and RPC.

```typescript
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CryerExceptionFilter } from 'cryer';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: CryerExceptionFilter({
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
import { Cryer } from 'cryer';

const cryer = new Cryer({ apiKey: 'your-api-key' });

// Add breadcrumbs for debugging trails
cryer.addBreadcrumb({
  message: 'User started checkout',
  category: 'action',
  data: { cartId: '123' }
});

// Set user context
cryer.setUserContext({
  id: 'user_456',
  email: 'user@example.com'
});

try {
  doWork();
} catch (error) {
  cryer.captureException(error, { custom_meta: 'extra-info' });
}
```

## Advanced Configuration

```typescript
const cryer = new Cryer({
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
