import { BaseOlusoOptions } from '@oluso/core';

export interface OlusoNextjsOptions extends BaseOlusoOptions {}

/**
 * Request info attached to an error report. Deliberately narrower than the
 * Node adapter's RequestContext -- the App Router's `Request` body is a
 * stream that can only be read once, and reading it here would leave
 * nothing for the actual route handler to consume, so `body` is only ever
 * populated from the Pages Router (`NextApiRequest` already parses it).
 */
export interface RequestContext {
  url: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, any>;
  body?: any;
  /** Which Next.js surface the request came through, when known. */
  routeType?: 'route-handler' | 'api-route' | 'middleware' | 'render' | 'action';
}

export interface RuntimeServerContext {
  runtime: 'nodejs' | 'edge';
  hostname?: string;
  platform?: string;
  nodeVersion?: string;
  memory?: {
    used: number;
    total: number;
  };
  uptime?: number;
}
