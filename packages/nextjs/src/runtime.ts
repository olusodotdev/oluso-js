import { RuntimeServerContext } from './types';

/**
 * `process.env.NEXT_RUNTIME` is Next.js's own documented way of telling
 * `nodejs` and `edge` execution apart at runtime (it's how their own
 * instrumentation.ts examples branch). Edge has no `os` module and no
 * `process.memoryUsage`/`process.uptime`, so anything Node-only has to be
 * gated behind this check rather than just feature-detected -- some Edge
 * polyfills of `process` are convincing enough that a bare try/catch around
 * `os.hostname()` isn't a reliable signal on its own.
 */
export function getRuntime(): 'nodejs' | 'edge' {
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_RUNTIME === 'edge') {
    return 'edge';
  }
  return 'nodejs';
}

export function getRuntimeServerContext(): RuntimeServerContext {
  const runtime = getRuntime();

  if (runtime === 'edge') {
    return {
      runtime,
      nodeVersion: typeof process !== 'undefined' ? process.version : undefined,
    };
  }

  try {
    const os = require('os');
    const memUsage = process.memoryUsage();
    return {
      runtime,
      hostname: os.hostname(),
      platform: `${os.platform()} ${os.release()}`,
      nodeVersion: process.version,
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
      },
      uptime: process.uptime(),
    };
  } catch {
    return { runtime };
  }
}

export default getRuntimeServerContext;
