import { ExceptionDetails } from '../types';
import Sanitizer from './sanitizer';

const RESERVED = new Set(['name', 'message', 'stack', 'cause']);

export function buildExceptionDetails(error: Error, sanitizer: Sanitizer): ExceptionDetails {
  const seen = new Set<any>();
  const visit = (current: any, depth: number): ExceptionDetails => {
    const value = current instanceof Error ? current : new Error(String(current));
    seen.add(current);
    const attributes: Record<string, any> = {};
    for (const key of Object.getOwnPropertyNames(current || {})) {
      if (!RESERVED.has(key)) attributes[key] = current[key];
    }
    const status = current?.status ?? current?.statusCode ?? current?.http_code;
    const result: ExceptionDetails = {
      type: value.name || value.constructor?.name || 'Error',
      message: sanitizer.truncateString(value.message || String(current), 4000),
      stack_trace: value.stack ? sanitizer.truncateString(value.stack, 16000) : undefined,
      code: current?.code,
      status_code: typeof status === 'number' ? status : undefined,
      attributes: Object.keys(attributes).length ? sanitizer.sanitizeObject(attributes, 6) : undefined,
    };
    const cause = current?.cause;
    if (cause != null && depth < 5 && !seen.has(cause)) result.causes = [visit(cause, depth + 1)];
    return result;
  };
  return visit(error, 0);
}
