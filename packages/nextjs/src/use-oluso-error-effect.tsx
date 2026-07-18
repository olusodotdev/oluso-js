'use client';

import { useEffect, useRef } from 'react';
import { useOluso } from '@oluso/react';

/**
 * Reports the error Next.js hands to an `error.tsx` boundary. Meant to be
 * called from the top of that file:
 *
 * ```tsx
 * 'use client';
 * import { useOlusoErrorEffect } from '@oluso/nextjs/client';
 *
 * export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
 *   useOlusoErrorEffect(error);
 *   return <div>Something went wrong <button onClick={reset}>Try again</button></div>;
 * }
 * ```
 *
 * Must be used within an `<OlusoProvider>` higher in the tree -- which
 * rules out `global-error.tsx` specifically, since it replaces the root
 * layout that the provider would normally live in. For that file, construct
 * an `OlusoClient` directly instead of using this hook.
 *
 * Reports in a `useEffect` (not during render) since `error.tsx` re-renders
 * on every `reset()` attempt with the same error object until it's actually
 * resolved -- reporting during render would re-report on each retry render,
 * not just the first.
 */
export function useOlusoErrorEffect(error: Error & { digest?: string }): void {
  const client = useOluso();
  const reportedRef = useRef<Error | null>(null);

  useEffect(() => {
    if (reportedRef.current === error) return;
    reportedRef.current = error;
    client.captureException(error, error.digest ? { digest: error.digest } : undefined);
  }, [error, client]);
}

export default useOlusoErrorEffect;
