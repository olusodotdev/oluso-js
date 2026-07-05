import { OlusoOptions } from '../types';
import type { ArgumentsHost } from '@nestjs/common';
/**
 * Create a NestJS exception filter for Oluso error monitoring
 *
 * Usage in your module:
 * ```typescript
 * import { APP_FILTER } from '@nestjs/core';
 * import { OlusoExceptionFilter } from 'oluso';
 *
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_FILTER,
 *       useClass: OlusoExceptionFilter({
 *         apiKey: 'your-api-key',
 *         environment: 'production'
 *       })
 *     }
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
export declare function OlusoExceptionFilter(options: OlusoOptions): {
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
export { OlusoExceptionFilter as createOlusoInterceptor };
