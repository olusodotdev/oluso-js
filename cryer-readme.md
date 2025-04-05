# Cryer

Automatic error reporting middleware for Node.js applications that reports to a centralized error tracking API.

## Installation

```bash
npm install cryer
```

## Features

- Automatic error reporting for Express and NestJS applications
- Global uncaught exception handling
- Smart tagging based on error context
- Severity classification based on HTTP status codes
- Secure API authentication via x-cryer-signature header

## Usage with Express

```typescript
import express from 'express';
import { cryerExpress } from 'cryer';

const app = express();

// Your routes and middleware here
app.get('/api/something', (req, res) => {
  // This will be caught and reported
  throw new Error('Something went wrong!');
});

// Add the error handler (should be after all routes)
app.use(cryerExpress({
  apiKey: 'your-api-key',
  environment: 'production',
  tags: ['api-server', 'v1'] // Optional: Default tags for all errors
}));

app.listen(3000);
```

## Usage with NestJS

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
        tags: ['nest-api', 'v1']
      })
    }
  ]
})
export class AppModule {}
```

## Manual Error Reporting

You can also report errors manually:

```typescript
import { Cryer } from 'cryer';

const cryer = new Cryer({
  apiKey: 'your-api-key',
  environment: 'production'
});

try {
  // Your code that might fail
  doSomethingRisky();
} catch (error) {
  // Manually report the error
  cryer.reportError(error);
}
```

## Advanced Configuration

```typescript
const cryer = new Cryer({
  apiKey: 'your-api-key',
  environment: 'staging',
  defaultSeverity: 'medium', // 'critical', 'high', 'medium', 'low'
  tags: ['backend', 'payment-service'],
  logToConsole: true, // Log errors to console (default: true)
  timeout: 3000, // Timeout for API requests in ms (default: 5000)
  shouldReport: (err, req, res) => {
    // Custom logic to determine if an error should be reported
    // For example, don't report 404 errors
    if (res && res.statusCode === 404) {
      return false;
    }
    return true;
  }
});
```

## Error Report Structure

The error reports sent to the API have the following structure:

```typescript
interface ErrorReport {
  title: string;         // Short, descriptive title for the error
  message: string;       // Detailed description of the error
  stack_trace?: string;  // Captures the stack trace (if applicable)
  environment?: string;  // Environment where the error occurred (e.g., "production", "staging")
  severity?: string;     // Severity level ("critical", "high", "medium", "low")
  tags?: string[];       // Optional tags for categorizing or filtering errors
}
```

## Authentication

The library authenticates with the error reporting API by sending your API key in the `x-cryer-signature` header with each request.

## License

MIT
