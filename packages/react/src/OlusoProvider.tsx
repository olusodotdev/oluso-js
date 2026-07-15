import { createContext, ReactNode, useRef } from 'react';
import { OlusoClient, OlusoBrowserOptions } from '@oluso/browser';

export const OlusoContext = createContext<OlusoClient | null>(null);

export interface OlusoProviderProps {
  options: OlusoBrowserOptions;
  children: ReactNode;
}

/**
 * Creates a single OlusoClient for the app and makes it available to
 * `useOluso()`. The client (and its global error listeners) is created once
 * and reused across re-renders.
 */
export function OlusoProvider({ options, children }: OlusoProviderProps) {
  const clientRef = useRef<OlusoClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new OlusoClient(options);
  }

  return (
    <OlusoContext.Provider value={clientRef.current}>
      {children}
    </OlusoContext.Provider>
  );
}

export default OlusoProvider;
