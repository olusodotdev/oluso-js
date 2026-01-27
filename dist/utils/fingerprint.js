"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFingerprint = generateFingerprint;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generate a fingerprint for error deduplication
 */
function generateFingerprint(error, context) {
    var _a;
    const components = [];
    // Add error type
    components.push(error.constructor.name);
    // Add error message (normalized)
    const normalizedMessage = normalizeErrorMessage(error.message);
    components.push(normalizedMessage);
    // Add stack trace signature (first few frames, excluding line numbers)
    if (error.stack) {
        const stackSignature = extractStackSignature(error.stack);
        components.push(stackSignature);
    }
    // Add route/endpoint if available
    if ((_a = context === null || context === void 0 ? void 0 : context.request) === null || _a === void 0 ? void 0 : _a.url) {
        const normalizedUrl = normalizeUrl(context.request.url);
        components.push(normalizedUrl);
    }
    // Create hash
    const fingerprint = crypto_1.default
        .createHash('md5')
        .update(components.join('|'))
        .digest('hex');
    return fingerprint;
}
/**
 * Normalize error message by removing dynamic values
 */
function normalizeErrorMessage(message) {
    return message
        // Remove numbers
        .replace(/\d+/g, 'N')
        // Remove UUIDs
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
        // Remove file paths
        .replace(/\/[\w\/.-]+/g, 'PATH')
        // Remove URLs
        .replace(/https?:\/\/[^\s]+/g, 'URL')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Extract stack signature (function names without line numbers)
 */
function extractStackSignature(stack) {
    const lines = stack.split('\n').slice(1, 6); // Take first 5 frames
    const frames = lines.map((line) => {
        // Extract function name from stack frame
        const match = line.match(/at\s+(?:(.+?)\s+\()?/);
        if (match && match[1]) {
            return match[1].trim();
        }
        return 'anonymous';
    });
    return frames.join('->');
}
/**
 * Normalize URL by removing dynamic segments
 */
function normalizeUrl(url) {
    return url
        // Remove query parameters
        .replace(/\?.*$/, '')
        // Remove numeric IDs
        .replace(/\/\d+/g, '/:id')
        // Remove UUIDs
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
        // Remove hash fragments
        .replace(/#.*$/, '');
}
exports.default = generateFingerprint;
