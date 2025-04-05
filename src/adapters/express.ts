import { Cryer } from '../index';
import { CryerOptions } from '../types';
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

export function cryerExpress(options: CryerOptions): ErrorRequestHandler {
  const cryer = new Cryer(options);
  
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    // Determine severity based on status code
    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
    let severity: 'critical' | 'high' | 'medium' | 'low' = options.defaultSeverity || 'medium';
    
    // Set severity based on status code
    if (statusCode >= 500) {
      severity = 'critical';
    } else if (statusCode >= 400) {
      severity = 'high';
    }
    
    // Set status code if not already set
    if (res.statusCode === 200) {
      res.status(statusCode);
    }
    
    // Customize the error object with additional info
    const errorWithMeta = err as any;
    errorWithMeta.severity = severity;
    
    // Report the error
    cryer.reportError(errorWithMeta, req, res);
    
    // Continue with the next error handler
    next(err);
  };
}