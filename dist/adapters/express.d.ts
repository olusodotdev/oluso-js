import { OlusoOptions } from '../types';
import { Request, Response, NextFunction } from 'express';
/**
 * Express middleware for Oluso error monitoring
 *
 * This middleware automatically detects whether it's being called as:
 * - Regular middleware (3 params): Tracks request context and response times
 * - Error handler (4 params): Captures and reports errors
 *
 * Usage:
 * ```
 * app.use(olusoExpress(options));
 * ```
 */
export declare function olusoExpress(options: OlusoOptions): (err: any, req: Request | Response, res: Response | NextFunction, next?: NextFunction) => void;
