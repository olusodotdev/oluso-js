import type { App, InjectionKey } from 'vue';
import { OlusoClient, OlusoBrowserOptions } from '@oluso/browser';

export const OLUSO_INJECTION_KEY: InjectionKey<OlusoClient> = Symbol('oluso');

declare module 'vue' {
  interface ComponentCustomProperties {
    $oluso: OlusoClient;
  }
}

/**
 * Vue plugin: `app.use(OlusoVuePlugin, options)`.
 *
 * Wires into `app.config.errorHandler` (preserving any handler that was
 * already set) to catch errors Vue intercepts from its own component tree —
 * these never reach `window.onerror`, since Vue swallows them into its own
 * error handler. Errors outside Vue's render tree (event handlers, timers,
 * unhandled rejections) are still caught globally by OlusoClient's own
 * `window` listeners.
 */
export const OlusoVuePlugin = {
  install(app: App, options: OlusoBrowserOptions): void {
    const client = new OlusoClient(options);

    const previousHandler = app.config.errorHandler;
    app.config.errorHandler = (err, instance, info) => {
      client.captureException(err as Error, { info });
      previousHandler?.(err, instance, info);
    };

    app.provide(OLUSO_INJECTION_KEY, client);
    app.config.globalProperties.$oluso = client;
  },
};

export default OlusoVuePlugin;
