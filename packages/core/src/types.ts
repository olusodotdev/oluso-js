export interface BaseOlusoOptions {
  /** API key for authentication (will be sent as x-oluso-signature header) */
  apiKey: string;

  /** Override the ingestion endpoint (defaults to the Oluso API) */
  endpoint?: string;

  /** Environment name (development, production, staging, etc.) */
  environment?: string;

  /** Default severity level for errors */
  defaultSeverity?: 'critical' | 'high' | 'medium' | 'low';

  /** Tags for categorizing errors */
  tags?: string[];

  /** Filter function to determine if an error should be reported */
  shouldReport?: (err: Error) => boolean;

  /** Timeout in milliseconds for API calls (default: 5000) */
  timeout?: number;

  /** Whether to log errors to console in addition to reporting (default: true) */
  logToConsole?: boolean;

  /** Maximum number of breadcrumbs to keep (default: 30) */
  maxBreadcrumbs?: number;

  /** Enable offline queue for failed reports (default: true) */
  enableOfflineQueue?: boolean;

  /** Maximum number of errors to queue offline (default: 100) */
  maxQueueSize?: number;

  /** Rate limit: maximum errors per minute (default: 60) */
  maxErrorsPerMinute?: number;

  /** Patterns for sanitizing sensitive data */
  sensitiveKeys?: string[];

  /** Custom fingerprint function for error deduplication */
  fingerprint?: (error: Error, context?: ErrorContext) => string;
}

export interface ErrorReport {
  title: string;
  message: string;
  stack_trace?: string;
  environment?: string;
  severity?: string;
  tags?: string[];
  fingerprint?: string;
  context?: ErrorContext;
  timestamp?: number;
}

export interface ErrorContext {
  user?: UserContext;
  device?: DeviceContext;
  custom?: Record<string, any>;
  breadcrumbs?: Breadcrumb[];
}

export interface Breadcrumb {
  timestamp: number;
  message: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  category?: string;
  data?: Record<string, any>;
}

export interface UserContext {
  id?: string;
  email?: string;
  username?: string;
  [key: string]: any;
}

/** Client-side (browser / React Native) equivalent of the Node ServerContext */
export interface DeviceContext {
  userAgent?: string;
  url?: string;
  language?: string;
  platform?: string;
  screen?: {
    width: number;
    height: number;
  };
  viewport?: {
    width: number;
    height: number;
  };
  online?: boolean;
}
