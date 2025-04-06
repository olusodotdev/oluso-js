export interface CryerOptions {
    /** API key for authentication (will be sent as x-cryer-signature header) */
    apiKey: string;
    /** Environment name (development, production, staging, etc.) */
    environment?: string;
    /** Default severity level for errors */
    defaultSeverity?: 'critical' | 'high' | 'medium' | 'low';
    /** Tags for categorizing errors */
    tags?: string[];
    /** Filter function to determine if an error should be reported */
    shouldReport?: (err: Error, req?: any, res?: any) => boolean;
    /** Timeout in milliseconds for API calls (default: 5000) */
    timeout?: number;
    /** Whether to log errors to console in addition to reporting (default: true) */
    logToConsole?: boolean;
}
export interface ErrorReport {
    title: string;
    message: string;
    stack_trace?: string;
    environment?: string;
    severity?: string;
    tags?: string[];
}
