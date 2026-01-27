import { ErrorContext } from '../types';
/**
 * Generate a fingerprint for error deduplication
 */
export declare function generateFingerprint(error: Error, context?: ErrorContext): string;
export default generateFingerprint;
