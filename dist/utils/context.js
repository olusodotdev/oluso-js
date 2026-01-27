"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const async_hooks_1 = require("async_hooks");
class ContextManager {
    constructor(maxBreadcrumbs = 30) {
        this.storage = new async_hooks_1.AsyncLocalStorage();
        this.maxBreadcrumbs = maxBreadcrumbs;
    }
    /**
     * Run a function with a new context
     */
    run(callback) {
        const contextData = {
            breadcrumbs: [],
            customContext: {},
        };
        return this.storage.run(contextData, callback);
    }
    /**
     * Add a breadcrumb to the current context
     */
    addBreadcrumb(breadcrumb) {
        const store = this.storage.getStore();
        if (!store)
            return;
        const fullBreadcrumb = {
            ...breadcrumb,
            timestamp: Date.now(),
        };
        store.breadcrumbs.push(fullBreadcrumb);
        // Keep only the last N breadcrumbs
        if (store.breadcrumbs.length > this.maxBreadcrumbs) {
            store.breadcrumbs.shift();
        }
    }
    /**
     * Set user context for the current request
     */
    setUserContext(user) {
        const store = this.storage.getStore();
        if (!store)
            return;
        store.userContext = user;
    }
    /**
     * Set custom context data
     */
    setCustomContext(key, value) {
        const store = this.storage.getStore();
        if (!store)
            return;
        store.customContext[key] = value;
    }
    /**
     * Set request start time for response time tracking
     */
    setRequestStartTime(time) {
        const store = this.storage.getStore();
        if (!store)
            return;
        store.requestStartTime = time;
    }
    /**
     * Get request start time
     */
    getRequestStartTime() {
        const store = this.storage.getStore();
        return store === null || store === void 0 ? void 0 : store.requestStartTime;
    }
    /**
     * Get all breadcrumbs from the current context
     */
    getBreadcrumbs() {
        const store = this.storage.getStore();
        return (store === null || store === void 0 ? void 0 : store.breadcrumbs) || [];
    }
    /**
     * Get user context from the current context
     */
    getUserContext() {
        const store = this.storage.getStore();
        return store === null || store === void 0 ? void 0 : store.userContext;
    }
    /**
     * Get custom context from the current context
     */
    getCustomContext() {
        const store = this.storage.getStore();
        return (store === null || store === void 0 ? void 0 : store.customContext) || {};
    }
    /**
     * Get all context data
     */
    getContext() {
        const store = this.storage.getStore();
        if (!store)
            return {};
        return {
            breadcrumbs: store.breadcrumbs,
            user: store.userContext,
            custom: store.customContext,
        };
    }
    /**
     * Clear all context data
     */
    clear() {
        const store = this.storage.getStore();
        if (!store)
            return;
        store.breadcrumbs = [];
        store.userContext = undefined;
        store.customContext = {};
        store.requestStartTime = undefined;
    }
}
exports.default = ContextManager;
