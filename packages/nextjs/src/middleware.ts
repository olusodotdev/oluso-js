import type { NextMiddleware } from 'next/server';
import { Oluso } from './client';
import { fromFetchRequest } from './request-context';

/**
 * Wraps Next.js middleware (`middleware.ts`), which always runs on the Edge
 * runtime. Reports thrown errors with a request-scoped breadcrumb trail,
 * then re-throws so Next.js's own handling of the failure is unchanged.
 *
 * ```ts
 * // middleware.ts
 * export const middleware = withOlusoMiddleware(oluso, async (req) => {
 *   ...
 * });
 * ```
 */
export function withOlusoMiddleware(oluso: Oluso, handler: NextMiddleware): NextMiddleware {
  return function olusoMiddleware(req, event) {
    return oluso.runInContext(async () => {
      const url = new URL(req.url);

      oluso.addBreadcrumb({
        message: `${req.method} ${url.pathname}`,
        level: 'info',
        category: 'http',
        data: { method: req.method, url: url.pathname },
      });

      try {
        return await handler(req, event);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        (err as any).severity = 'critical';
        await oluso.reportError(err, fromFetchRequest(req));
        throw error;
      }
    });
  };
}
