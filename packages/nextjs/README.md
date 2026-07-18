# @oluso/nextjs

AI-powered error monitoring for Next.js applications: server-side capture for the App Router, Pages Router, and Middleware, plus React bindings for Client Components. Works unchanged on both the Node.js and Edge runtimes.

## Installation

```bash
npm install @oluso/nextjs
```

Requires Next.js `>=13.4.0` and React `>=18.2.0`.

## Recommended setup: `instrumentation.ts`

Next.js's [`instrumentation.ts`](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation) is the one place guaranteed to run exactly once per server instance, and its `onRequestError` hook is called for errors from Server Components, Route Handlers, Server Actions, and Middleware — whether or not you've wrapped them individually. This is the fastest path to full coverage:

```ts
// instrumentation.ts
import { Oluso, registerOlusoProcessHandlers, createOnRequestError } from '@oluso/nextjs';

export const oluso = new Oluso({
  apiKey: process.env.OLUSO_API_KEY!,
  environment: process.env.NODE_ENV,
});

export async function register() {
  registerOlusoProcessHandlers(oluso); // uncaughtException / unhandledRejection, Node runtime only
}

export const onRequestError = createOnRequestError(oluso);
```

That's the whole server-side integration for a basic setup. The `with*` wrappers below are opt-in, for routes where you also want request-scoped breadcrumbs recorded *during* the handler, not just the failure itself.

## App Router route handlers

```ts
// app/api/widgets/route.ts
import { withOluso } from '@oluso/nextjs';
import { oluso } from '../../../instrumentation';

export const GET = withOluso(oluso, async (req) => {
  oluso.addBreadcrumb({ message: 'fetching widgets', category: 'db' });
  const widgets = await db.widgets.findMany();
  return Response.json(widgets);
});
```

Wrap each exported method (`GET`, `POST`, ...) separately. Thrown errors and 5xx responses are reported with the request's method, URL, and sanitized headers attached; the request body is never read here (it's a stream your handler needs to consume itself).

## Pages Router API routes

```ts
// pages/api/widgets.ts
import { withOlusoApiRoute } from '@oluso/nextjs';
import { oluso } from '../../instrumentation';

export default withOlusoApiRoute(oluso, async (req, res) => {
  const widgets = await db.widgets.findMany();
  res.json(widgets);
});
```

## Middleware

```ts
// middleware.ts
import { withOlusoMiddleware } from '@oluso/nextjs';
import { oluso } from './instrumentation';

export const middleware = withOlusoMiddleware(oluso, async (req) => {
  ...
});
```

Middleware always runs on the Edge runtime — this wrapper (and the rest of the server client) has no dependency on Node's `http`/`os` modules, so it works there unchanged.

## Client Components

Import from the `/client` subpath, which carries its own `'use client'` directive — importing these from the main entry point would pull server-only code into the client bundle.

```tsx
// app/layout.tsx
import { OlusoProvider } from '@oluso/nextjs/client';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <OlusoProvider options={{ apiKey: process.env.NEXT_PUBLIC_OLUSO_API_KEY! }}>
          {children}
        </OlusoProvider>
      </body>
    </html>
  );
}
```

```tsx
// app/dashboard/error.tsx
'use client';
import { useOlusoErrorEffect } from '@oluso/nextjs/client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useOlusoErrorEffect(error); // reports once per distinct error, including error.digest
  return (
    <div>
      Something went wrong.
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

`useOlusoErrorEffect` needs an `<OlusoProvider>` above it in the tree, which rules out `global-error.tsx` specifically — it replaces the root layout the provider would normally live in. For that file, construct an `OlusoClient` directly instead:

```tsx
// app/global-error.tsx
'use client';
import { OlusoClient } from '@oluso/nextjs/client';
import { useEffect } from 'react';

const client = new OlusoClient({ apiKey: process.env.NEXT_PUBLIC_OLUSO_API_KEY! });

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    client.captureException(error);
  }, [error]);

  return (
    <html>
      <body>Something went seriously wrong.</body>
    </html>
  );
}
```

`useOluso()` and `ErrorBoundary` are also re-exported from `@oluso/nextjs/client` for manual reporting and non-route error boundaries, same as `@oluso/react`.

## Breadcrumbs & User Context (server-side)

`oluso.addBreadcrumb`/`setUserContext`/`setCustomContext` are scoped to the current request when called inside a `with*` wrapper (via `AsyncLocalStorage`), so concurrent requests on a self-hosted, long-running Next.js server don't bleed context into each other:

```ts
export const POST = withOluso(oluso, async (req) => {
  const user = await getUser(req);
  oluso.setUserContext({ id: user.id });
  oluso.addBreadcrumb({ message: 'checkout started', category: 'action' });

  try {
    await doCheckout();
  } catch (err) {
    oluso.captureException(err, { step: 'checkout' });
    return Response.json({ error: 'checkout failed' }, { status: 500 });
  }

  return Response.json({ ok: true });
});
```

## Advanced Configuration

```ts
new Oluso({
  apiKey: 'your-api-key',
  endpoint: 'https://api.oluso.dev/api/v1/error/report', // override for self-hosting
  environment: 'staging',
  defaultSeverity: 'medium',
  maxBreadcrumbs: 50,
  maxErrorsPerMinute: 100,
  sensitiveKeys: ['ssn', 'internal_id'],
  shouldReport: (err) => !err.message.includes('expected'),
});
```

## License

MIT
