import { Oluso } from '../index';
import { OlusoOptions } from '../types';
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Injectable,
  HttpException,
  HttpStatus
} from '@nestjs/common';

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
export function OlusoExceptionFilter(options: OlusoOptions) {
  const oluso = new Oluso(options);

  @Catch()
  @Injectable()
  class OlusoFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
      const contextType = host.getType();

      // Handle different context types
      switch (contextType) {
        case 'http':
          this.handleHttpException(exception, host);
          break;
        case 'rpc':
          this.handleRpcException(exception, host);
          break;
        case 'ws':
          this.handleWsException(exception, host);
          break;
        default:
          this.handleGenericException(exception, host);
      }
    }

    /**
     * Handle HTTP exceptions (REST APIs)
     */
    handleHttpException(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const request = ctx.getRequest();
      const response = ctx.getResponse();

      // Extract status and message
      const status = exception instanceof HttpException
        ? exception.getStatus()
        : (exception as any)?.status || (exception as any)?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;

      const error = exception instanceof Error
        ? exception
        : new Error(String(exception));

      // Determine severity
      let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
      if (status >= 500) {
        severity = 'critical';
      } else if (status >= 400) {
        severity = 'high';
      }

      (error as any).severity = severity;

      // Add breadcrumb
      oluso.addBreadcrumb({
        message: `HTTP Error ${status}: ${error.message}`,
        level: 'error',
        category: 'http',
        data: {
          statusCode: status,
          path: request.url,
          method: request.method,
        },
      });

      // Report error
      oluso.reportError(error, request, response);

      // Send response
      const errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: exception instanceof HttpException
          ? exception.getResponse()
          : (exception as any)?.message || 'Internal server error',
      };

      response.status(status).json(errorResponse);
    }

    /**
     * Handle RPC/Microservice exceptions
     */
    handleRpcException(exception: unknown, host: ArgumentsHost) {
      const error = exception instanceof Error
        ? exception
        : new Error(String(exception));

      (error as any).severity = 'high';

      oluso.addBreadcrumb({
        message: `RPC Error: ${error.message}`,
        level: 'error',
        category: 'rpc',
      });

      oluso.reportError(error);

      // Re-throw for RPC error handling
      throw exception;
    }

    /**
     * Handle WebSocket exceptions
     */
    handleWsException(exception: unknown, host: ArgumentsHost) {
      const client = host.switchToWs().getClient();
      const data = host.switchToWs().getData();

      const error = exception instanceof Error
        ? exception
        : new Error(String(exception));

      (error as any).severity = 'high';

      oluso.addBreadcrumb({
        message: `WebSocket Error: ${error.message}`,
        level: 'error',
        category: 'websocket',
        data: {
          event: data?.event,
        },
      });

      oluso.reportError(error);

      // Emit error to client
      client.emit('error', {
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    /**
     * Handle generic exceptions
     */
    handleGenericException(exception: unknown, host: ArgumentsHost) {
      const error = exception instanceof Error
        ? exception
        : new Error(String(exception));

      (error as any).severity = 'critical';

      oluso.addBreadcrumb({
        message: `Unhandled Error: ${error.message}`,
        level: 'error',
        category: 'error',
      });

      oluso.reportError(error);
    }
  }

  return OlusoFilter;
}

// Export for backward compatibility
export { OlusoExceptionFilter as createOlusoInterceptor };