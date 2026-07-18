import type { AsyncLocalStorage as AsyncLocalStorageType } from 'async_hooks';
import { Breadcrumb, ErrorContext, UserContext } from '@oluso/core';

interface ContextData {
  breadcrumbs: Breadcrumb[];
  userContext?: UserContext;
  customContext: Record<string, any>;
}

interface Store<T> {
  run<R>(data: T, callback: () => R): R;
  getStore(): T | undefined;
}

function createStorage<T>(): Store<T> {
  try {
    // AsyncLocalStorage is on Vercel/Next.js's list of supported Edge
    // Runtime APIs (Next uses it internally for next/headers), but this is
    // guarded the same defensive way @oluso/node guards worker_threads/
    // cluster: if some other Edge-like environment this package ends up
    // running in doesn't have it, fall back rather than crash.
    const { AsyncLocalStorage } = require('async_hooks') as {
      AsyncLocalStorage: typeof AsyncLocalStorageType;
    };
    return new AsyncLocalStorage<T>();
  } catch {
    let current: T | undefined;
    return {
      run(data, callback) {
        current = data;
        try {
          return callback();
        } finally {
          current = undefined;
        }
      },
      getStore() {
        return current;
      },
    };
  }
}

/**
 * Request-scoped breadcrumb/user/context store, the Next.js counterpart to
 * @oluso/node's ContextManager. Route/middleware wrappers call `run()` once
 * per request so concurrent requests on a long-running Node server (e.g.
 * self-hosted via `next start`) don't bleed breadcrumbs into each other.
 *
 * Falls back to a single shared store when called outside `run()` -- e.g. a
 * Server Component rendered without an explicit wrapper, or a call made
 * from module scope during startup -- mirroring @oluso/browser's flat
 * (non-request-scoped) behavior rather than silently dropping the data.
 */
export class NextjsContextManager {
  private storage: Store<ContextData>;
  private globalStore: ContextData = { breadcrumbs: [], customContext: {} };
  private maxBreadcrumbs: number;

  constructor(maxBreadcrumbs: number = 30) {
    this.storage = createStorage<ContextData>();
    this.maxBreadcrumbs = maxBreadcrumbs;
  }

  run<T>(callback: () => T): T {
    return this.storage.run({ breadcrumbs: [], customContext: {} }, callback);
  }

  private store(): ContextData {
    return this.storage.getStore() ?? this.globalStore;
  }

  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    const store = this.store();
    store.breadcrumbs.push({ ...breadcrumb, timestamp: Date.now() });
    if (store.breadcrumbs.length > this.maxBreadcrumbs) {
      store.breadcrumbs.shift();
    }
  }

  setUserContext(user: UserContext): void {
    this.store().userContext = user;
  }

  setCustomContext(key: string, value: any): void {
    this.store().customContext[key] = value;
  }

  getContext(): Partial<ErrorContext> {
    const store = this.store();
    return {
      breadcrumbs: store.breadcrumbs,
      user: store.userContext,
      custom: store.customContext,
    };
  }
}

export default NextjsContextManager;
