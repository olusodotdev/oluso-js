import { Oluso } from './client';
import { fromFetchRequest } from './request-context';

export type RouteHandler<Ctx = any> = (
  req: Request,
  ctx: Ctx
) => Response | Promise<Response>;

/**
 * Wraps an App Router route handler (`app/**\/route.ts`). Reports thrown
 * errors and 5xx responses, with a request-scoped breadcrumb trail around
 * the handler call, then re-throws / passes the response through unchanged
 * so Next.js's own error handling still runs.
 *
 * ```ts
 * // app/api/widgets/route.ts
 * export const GET = withOluso(oluso, async (req) => {
 *   ...
 * });
 * ```
 *
 * Each exported method (GET/POST/...) needs its own `withOluso(...)` call --
 * Next.js dispatches by which named export exists, same reason
 * @oluso/node's Express adapter needs two separate functions instead of one.
 */
export function withOluso<Ctx = any>(oluso: Oluso, handler: RouteHandler<Ctx>): RouteHandler<Ctx> {
  return function olusoRouteHandler(req: Request, ctx: Ctx) {
    return oluso.runInContext(async () => {
      const url = new URL(req.url);

      oluso.addBreadcrumb({
        message: `${req.method} ${url.pathname}`,
        level: 'info',
        category: 'http',
        data: { method: req.method, url: url.pathname },
      });

      try {
        const res = await handler(req, ctx);

        if (res.status >= 500) {
          const error = new Error(`Server error: ${res.status} - ${req.method} ${url.pathname}`);
          (error as any).severity = 'critical';
          await oluso.reportError(error, fromFetchRequest(req));
        }

        return res;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        (err as any).severity = 'critical';
        await oluso.reportError(err, fromFetchRequest(req));
        throw error;
      }
    });
  };
}
