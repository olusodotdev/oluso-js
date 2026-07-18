import { Oluso } from './client';
import { getRuntime } from './runtime';

/**
 * Registers `process.on('uncaughtException'/'unhandledRejection', ...)`
 * handlers, mirroring @oluso/node's global handlers. Call this from the
 * `register()` export of your `instrumentation.ts` -- Next.js calls
 * `register()` once per server instance, before any other code runs, which
 * is the one place in a Next.js app that's guaranteed to run exactly once
 * (a module-scope side effect in a route file can run once per route
 * per worker, not once for the whole server).
 *
 * No-ops on the Edge runtime: `process.on` isn't available there, and
 * `register()` itself already runs there too (Next.js calls it once per
 * runtime the app uses), so this has to check rather than assume Node.
 */
export function registerOlusoProcessHandlers(oluso: Oluso): void {
  if (typeof process === 'undefined' || typeof process.on !== 'function') return;
  if (getRuntime() !== 'nodejs') return;

  process.on('uncaughtException', (error) => {
    oluso.addBreadcrumb({
      message: 'Uncaught exception occurred',
      level: 'error',
      category: 'error',
    });
    (error as any).severity = 'critical';
    oluso.reportError(error);
  });

  process.on('unhandledRejection', (reason) => {
    oluso.addBreadcrumb({
      message: 'Unhandled promise rejection',
      level: 'error',
      category: 'promise',
    });

    const error = reason instanceof Error ? reason : new Error(`Unhandled rejection: ${String(reason)}`);
    (error as any).severity = 'critical';
    oluso.reportError(error);
  });
}

export interface NextRequestErrorInfo {
  path: string;
  method: string;
  headers: Record<string, string>;
}

export interface NextRequestErrorContext {
  routerKind?: 'Pages Router' | 'App Router';
  routePath?: string;
  routeType?: 'render' | 'route' | 'action' | 'middleware';
}

/**
 * Builds the `onRequestError` export for `instrumentation.ts` -- the hook
 * Next.js (15+) calls for errors from Server Components, Route Handlers,
 * Server Actions, and Middleware, whether or not they're individually
 * wrapped with `withOluso`/`withOlusoMiddleware`. This is the zero-config
 * catch-all; the `with*` wrappers exist for the cases where you also want
 * request-scoped breadcrumbs recorded *during* the handler, not just the
 * failure itself.
 *
 * ```ts
 * // instrumentation.ts
 * import { Oluso, registerOlusoProcessHandlers, createOnRequestError } from '@oluso/nextjs';
 *
 * const oluso = new Oluso({ apiKey: process.env.OLUSO_API_KEY! });
 *
 * export async function register() {
 *   registerOlusoProcessHandlers(oluso);
 * }
 *
 * export const onRequestError = createOnRequestError(oluso);
 * ```
 */
export function createOnRequestError(oluso: Oluso) {
  return async function onRequestError(
    error: unknown,
    request: NextRequestErrorInfo,
    context: NextRequestErrorContext
  ): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));
    (err as any).severity = 'critical';

    await oluso.reportError(err, {
      url: request.path,
      method: request.method,
      headers: request.headers,
      routeType:
        context.routeType === 'route'
          ? 'route-handler'
          : context.routeType === 'action'
            ? 'action'
            : context.routeType === 'middleware'
              ? 'middleware'
              : 'render',
    });
  };
}
