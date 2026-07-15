import { ErrorContext } from './types';

/**
 * Generate a fingerprint for error deduplication.
 *
 * Uses a plain FNV-1a hash rather than Node's `crypto` module so this works
 * identically in Node, browsers, and React Native without a crypto polyfill.
 * Deduplication only needs a stable, well-distributed hash, not a cryptographic one.
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

    return fnv1aHash(components.join('|'));
}

/**
 * FNV-1a hash, returned as an 8-character hex string
 */
function fnv1aHash(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
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

export default generateFingerprint;
