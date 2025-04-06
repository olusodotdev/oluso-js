import { CryerOptions } from '../types';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
export declare function createCryerInterceptor(options: CryerOptions): {
    new (): {
        intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
    };
};
