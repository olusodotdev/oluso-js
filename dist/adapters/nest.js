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
exports.createCryerInterceptor = createCryerInterceptor;
const index_1 = require("../index");
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
// Create a unified interceptor that handles both caught and uncaught errors
function createCryerInterceptor(options) {
    const cryer = new index_1.Cryer(options);
    let UnifiedCryerInterceptor = (() => {
        let _classDecorators = [(0, common_1.Injectable)()];
        let _classDescriptor;
        let _classExtraInitializers = [];
        let _classThis;
        var UnifiedCryerInterceptor = _classThis = class {
            intercept(context, next) {
                // Get the HTTP context
                const httpContext = context.switchToHttp();
                const request = httpContext.getRequest();
                const response = httpContext.getResponse();
                // Initialize tracking flag
                const reportedErrorKey = '__cryerErrorReported';
                response[reportedErrorKey] = false;
                return next.handle().pipe(
                // Handle successful responses with error status codes
                (0, operators_1.tap)(() => {
                    if (response.statusCode >= 500 && !response[reportedErrorKey]) {
                        const serverError = new Error(`Server error: ${response.statusCode}`);
                        const errorWithMeta = serverError;
                        errorWithMeta.severity = 'critical';
                        errorWithMeta.path = request.path;
                        errorWithMeta.method = request.method;
                        cryer.reportError(errorWithMeta, request, response);
                        response[reportedErrorKey] = true;
                    }
                }), 
                // Handle exceptions
                (0, operators_1.catchError)(exception => {
                    if (!response[reportedErrorKey]) {
                        // Extract status code from the exception if available
                        const status = exception.status || exception.statusCode || 500;
                        // Determine severity based on status code
                        let severity = options.defaultSeverity || 'medium';
                        if (status >= 500) {
                            severity = 'critical';
                        }
                        else if (status >= 400) {
                            severity = 'high';
                        }
                        // Add severity to the exception
                        exception.severity = severity;
                        // Only report server errors (500) or if specifically configured
                        if (status >= 500 || (options.shouldReport && options.shouldReport(exception, request, response))) {
                            cryer.reportError(exception, request, response);
                            response[reportedErrorKey] = true;
                        }
                    }
                    // Re-throw the exception to let NestJS handle the response
                    throw exception;
                }));
            }
        };
        __setFunctionName(_classThis, "UnifiedCryerInterceptor");
        (() => {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            UnifiedCryerInterceptor = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        })();
        return UnifiedCryerInterceptor = _classThis;
    })();
    return UnifiedCryerInterceptor;
}
// Usage in your application
// const GlobalCryerInterceptor = createCryerInterceptor({
//   apiKey: process.env.CRYER_API_KEY,
//   environment: 'development',
//   tags: ['test-nest']
// });
// app.useGlobalInterceptors(new GlobalCryerInterceptor());
