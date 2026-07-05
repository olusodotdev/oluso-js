"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OlusoExceptionFilter = OlusoExceptionFilter;
exports.createOlusoInterceptor = OlusoExceptionFilter;
const index_1 = require("../index");
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
function OlusoExceptionFilter(options) {
    // Required lazily so pure-Express consumers aren't forced to install
    // the optional @nestjs/common peer dependency just to import this module.
    const { Catch, Injectable, HttpException, HttpStatus } = require('@nestjs/common');
    const oluso = new index_1.Oluso(options);
    let OlusoFilter = (() => {
        let _classDecorators = [Catch(), Injectable()];
        let _classDescriptor;
        let _classExtraInitializers = [];
        let _classThis;
        var OlusoFilter = _classThis = class {
            catch(exception, host) {
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
            handleHttpException(exception, host) {
                const ctx = host.switchToHttp();
                const request = ctx.getRequest();
                const response = ctx.getResponse();
                // Extract status and message
                const status = exception instanceof HttpException
                    ? exception.getStatus()
                    : (exception === null || exception === void 0 ? void 0 : exception.status) || (exception === null || exception === void 0 ? void 0 : exception.statusCode) || HttpStatus.INTERNAL_SERVER_ERROR;
                const error = exception instanceof Error
                    ? exception
                    : new Error(String(exception));
                // Determine severity
                let severity = 'medium';
                if (status >= 500) {
                    severity = 'critical';
                }
                else if (status >= 400) {
                    severity = 'high';
                }
                error.severity = severity;
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
                        : (exception === null || exception === void 0 ? void 0 : exception.message) || 'Internal server error',
                };
                response.status(status).json(errorResponse);
            }
            /**
             * Handle RPC/Microservice exceptions
             */
            handleRpcException(exception, host) {
                const error = exception instanceof Error
                    ? exception
                    : new Error(String(exception));
                error.severity = 'high';
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
            handleWsException(exception, host) {
                const client = host.switchToWs().getClient();
                const data = host.switchToWs().getData();
                const error = exception instanceof Error
                    ? exception
                    : new Error(String(exception));
                error.severity = 'high';
                oluso.addBreadcrumb({
                    message: `WebSocket Error: ${error.message}`,
                    level: 'error',
                    category: 'websocket',
                    data: {
                        event: data === null || data === void 0 ? void 0 : data.event,
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
            handleGenericException(exception, host) {
                const error = exception instanceof Error
                    ? exception
                    : new Error(String(exception));
                error.severity = 'critical';
                oluso.addBreadcrumb({
                    message: `Unhandled Error: ${error.message}`,
                    level: 'error',
                    category: 'error',
                });
                oluso.reportError(error);
            }
        };
        __setFunctionName(_classThis, "OlusoFilter");
        (() => {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            OlusoFilter = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        })();
        return OlusoFilter = _classThis;
    })();
    return OlusoFilter;
}
