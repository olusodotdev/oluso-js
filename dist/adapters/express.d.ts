import { CryerOptions } from '../types';
import { Request, Response, NextFunction } from 'express';
/**
 * Express middleware for Cryer error monitoring
 *
 * This middleware automatically detects whether it's being called as:
 * - Regular middleware (3 params): Tracks request context and response times
 * - Error handler (4 params): Captures and reports errors
 *
 * Usage:
 * ```
 * app.use(cryerExpress(options));
 * ```
 */
export declare function cryerExpress(options: CryerOptions): (err: any, req: Request | Response, res: Response | NextFunction, next?: NextFunction) => void;
