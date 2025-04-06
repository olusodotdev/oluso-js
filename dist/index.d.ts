import { CryerOptions } from './types';
export * from './types';
export * from './adapters/express';
export * from './adapters/nest';
export declare class Cryer {
    private options;
    private reportUrl;
    constructor(options: CryerOptions);
    private registerGlobalHandlers;
    reportError(error: Error, req?: any, res?: any): Promise<void>;
    private generateErrorTitle;
    private extractSeverity;
    private generateTags;
}
