import { Component, ErrorInfo, ReactNode } from 'react';
import { OlusoClient } from './client';

export interface ErrorBoundaryProps {
  client: OlusoClient;
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors in the wrapped subtree, reports them via the
 * given OlusoClient, and renders a fallback instead of unmounting the app.
 *
 * Note: like all React error boundaries, this only catches errors thrown
 * during rendering, in lifecycle methods, and in constructors of the
 * component tree below it — not in event handlers or async code. Those are
 * caught globally via ErrorUtils (see OlusoClient), or can be reported
 * manually with `client.captureException()`.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.client.captureException(error, {
      componentStack: info.componentStack,
    });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;

    if (error) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback(error, this.reset);
      }
      if (fallback) {
        return fallback;
      }
      return null;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
