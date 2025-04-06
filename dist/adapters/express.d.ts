import { CryerOptions } from '../types';
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
export declare function cryerExpress(options: CryerOptions): {
    errorHandler: ErrorRequestHandler;
    middleware: (req: Request, res: Response, next: NextFunction) => void;
};
