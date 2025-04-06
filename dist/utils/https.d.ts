import { ErrorReport } from '../types';
interface SendOptions {
    apiKey: string;
    timeout?: number;
}
export declare function sendErrorReport(reportUrl: string, errorReport: ErrorReport, options: SendOptions): Promise<void>;
export {};
