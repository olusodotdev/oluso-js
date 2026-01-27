import crypto from 'crypto';
import { ErrorContext } from '../types';

/**
 * Generate a fingerprint for error deduplication
 */
export function generateFingerprint(
    error: Error,
    context?: ErrorContext
): string {
    const components: string[] = [];

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
    if (context?.request?.url) {
        const normalizedUrl = normalizeUrl(context.request.url);
        components.push(normalizedUrl);
    }

    // Create hash
    const fingerprint = crypto
        .createHash('md5')
        .update(components.join('|'))
        .digest('hex');

    return fingerprint;
}

/**
 * Normalize error message by removing dynamic values
 */
function normalizeErrorMessage(message: string): string {
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
function extractStackSignature(stack: string): string {
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
function normalizeUrl(url: string): string {
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

export default generateFingerprint;
