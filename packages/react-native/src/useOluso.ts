import { useContext } from 'react';
import { OlusoContext } from './OlusoProvider';
import { OlusoClient } from './client';

/**
 * Access the OlusoClient created by the nearest <OlusoProvider>, for manual
 * breadcrumb tracking, user context, and error capture from function
 * components.
 */
export function useOluso(): OlusoClient {
  const client = useContext(OlusoContext);
  if (!client) {
    throw new Error('useOluso() must be used within an <OlusoProvider>');
  }
  return client;
}

export default useOluso;
