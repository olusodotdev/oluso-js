import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { Oluso } from './client';
import { fromApiRequest } from './request-context';

/**
 * Wraps a Pages Router API route (`pages/api/**\/*.ts`). Reports thrown
 * errors and 5xx responses, with a request-scoped breadcrumb trail around
 * the handler call.
 *
 * ```ts
 * // pages/api/widgets.ts
 * export default withOlusoApiRoute(oluso, async (req, res) => {
 *   ...
 * });
 * ```
 */
export function withOlusoApiRoute(oluso: Oluso, handler: NextApiHandler): NextApiHandler {
  return function olusoApiHandler(req: NextApiRequest, res: NextApiResponse) {
    return oluso.runInContext(async () => {
      oluso.addBreadcrumb({
        message: `${req.method} ${req.url}`,
        level: 'info',
        category: 'http',
        data: { method: req.method, url: req.url },
      });

      try {
        await handler(req, res);

        if (res.statusCode >= 500) {
          const error = new Error(`Server error: ${res.statusCode} - ${req.method} ${req.url}`);
          (error as any).severity = 'critical';
          await oluso.reportError(error, fromApiRequest(req));
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        (err as any).severity = 'critical';
        await oluso.reportError(err, fromApiRequest(req));
        throw error;
      }
    });
  };
}
