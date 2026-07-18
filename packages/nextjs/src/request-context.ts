import type { NextApiRequest } from 'next';
import { RequestContext } from './types';

/**
 * Builds a RequestContext from a Fetch API `Request` (App Router route
 * handlers, middleware). Deliberately never reads `req.body` -- it's a
 * stream that can only be consumed once, and doing it here would leave
 * nothing for the actual handler to read.
 */
export function fromFetchRequest(req: Request): RequestContext {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  return {
    url: url.pathname + url.search,
    method: req.method,
    headers,
    query,
  };
}

/**
 * Builds a RequestContext from a Pages Router `NextApiRequest`, which --
 * unlike the App Router's Fetch API Request -- already has its body parsed
 * for us, so it's safe to include here.
 */
export function fromApiRequest(req: NextApiRequest): RequestContext {
  return {
    url: req.url || '',
    method: req.method || '',
    headers: req.headers as Record<string, string>,
    query: req.query as Record<string, any>,
    body: req.body,
  };
}
