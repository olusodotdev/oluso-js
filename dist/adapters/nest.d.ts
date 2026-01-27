import { CryerOptions } from '../types';
import { ArgumentsHost } from '@nestjs/common';
/**
 * Create a NestJS exception filter for Cryer error monitoring
 *
 * Usage in your module:
 * ```typescript
 * import { APP_FILTER } from '@nestjs/core';
 * import { CryerExceptionFilter } from 'cryer';
 *
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_FILTER,
 *       useClass: CryerExceptionFilter({
 *         apiKey: 'your-api-key',
 *         environment: 'production'
 *       })
 *     }
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
export declare function CryerExceptionFilter(options: CryerOptions): {
    new (): {
        catch(exception: unknown, host: ArgumentsHost): void;
        /**
         * Handle HTTP exceptions (REST APIs)
         */
        handleHttpException(exception: unknown, host: ArgumentsHost): void;
        /**
         * Handle RPC/Microservice exceptions
         */
        handleRpcException(exception: unknown, host: ArgumentsHost): void;
        /**
         * Handle WebSocket exceptions
         */
        handleWsException(exception: unknown, host: ArgumentsHost): void;
        /**
         * Handle generic exceptions
         */
        handleGenericException(exception: unknown, host: ArgumentsHost): void;
    };
};
export { CryerExceptionFilter as createCryerInterceptor };
