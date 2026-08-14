import { ErrorReport } from '@oluso/core';

interface SendOptions {
  apiKey: string;
  timeout?: number;
  logToConsole?: boolean;
}

export const MAX_DIAGNOSTIC_PAYLOAD_BYTES = 512 * 1024;

// Browsers cap the total in-flight keepalive request body at ~64 KiB;
// larger payloads must send without keepalive rather than fail outright.
export const MAX_KEEPALIVE_PAYLOAD_BYTES = 60 * 1024;

/** The report exceeds the transport's payload cap. Retrying or queueing an
 * oversized report can never succeed — callers must trim or drop it. */
export class PayloadTooLargeError extends Error {
  constructor(payloadBytes: number) {
    super(`Oluso report payload is ${payloadBytes} bytes; maximum is ${MAX_DIAGNOSTIC_PAYLOAD_BYTES}`);
    this.name = 'PayloadTooLargeError';
  }
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

/**
 * Send an error report via fetch. Rejects on failure (network error,
 * non-2xx status, or PayloadTooLargeError before any request is made) —
 * callers decide whether a failed report is queued, trimmed, or dropped.
 */
export function sendErrorReport(
  reportUrl: string,
  errorReport: ErrorReport,
  options: SendOptions
): Promise<void> {
  const body = JSON.stringify(errorReport);
  const payloadBytes = utf8ByteLength(body);
  if (payloadBytes > MAX_DIAGNOSTIC_PAYLOAD_BYTES) {
    return Promise.reject(new PayloadTooLargeError(payloadBytes));
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), options.timeout || 5000)
    : undefined;

  return fetch(reportUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-oluso-signature': options.apiKey,
    },
    body,
    signal: controller?.signal,
    keepalive: payloadBytes <= MAX_KEEPALIVE_PAYLOAD_BYTES,
  })
    .then((res) => {
      if (!res.ok) {
        if (options.logToConsole) {
          console.error(`[Oluso] Error reporting failed with status ${res.status}`);
        }
        throw new Error(`Oluso reporting failed with status ${res.status}`);
      }
    })
    .catch((err) => {
      if (options.logToConsole) {
        console.error('[Oluso] Failed to send error report:', err?.message || err);
      }
      throw err;
    })
    .finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
}
