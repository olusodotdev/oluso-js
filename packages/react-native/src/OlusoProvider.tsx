import { createContext, ReactNode, useRef } from 'react';
import { OlusoClient, OlusoReactNativeOptions } from './client';

export const OlusoContext = createContext<OlusoClient | null>(null);

export interface OlusoProviderProps {
  options: OlusoReactNativeOptions;
  children: ReactNode;
}

/**
 * Creates a single OlusoClient for the app and makes it available to
 * `useOluso()`. The client (and its global ErrorUtils handler) is created
 * once and reused across re-renders.
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
