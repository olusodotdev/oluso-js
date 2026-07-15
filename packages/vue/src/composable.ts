import { inject } from 'vue';
import { OlusoClient } from '@oluso/browser';
import { OLUSO_INJECTION_KEY } from './plugin';

/**
 * Access the OlusoClient installed by `app.use(OlusoVuePlugin, options)`,
 * for manual breadcrumb tracking, user context, and error capture from
 * setup() / the Composition API.
 */
export function useOluso(): OlusoClient {
  const client = inject(OLUSO_INJECTION_KEY);
  if (!client) {
    throw new Error(
      'useOluso() must be used after installing OlusoVuePlugin: app.use(OlusoVuePlugin, options)'
    );
  }
  return client;
}

export default useOluso;
