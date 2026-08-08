import { ErrorReport } from '@oluso/core';

interface SendOptions {
  apiKey: string;
  timeout?: number;
  logToConsole?: boolean;
}

export const MAX_DIAGNOSTIC_PAYLOAD_BYTES = 512 * 1024;
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

/**
 * Send an error report via fetch. Never rejects — a failed send should
 * never crash the host application, it just means the report gets queued.
 */
export function sendErrorReport(
  reportUrl: string,
  errorReport: ErrorReport,
  options: SendOptions
): Promise<void> {
  const body = JSON.stringify(errorReport);
  const payloadBytes = utf8ByteLength(body);
  if (payloadBytes > MAX_DIAGNOSTIC_PAYLOAD_BYTES) {
    return Promise.reject(new Error(`Oluso report payload is ${payloadBytes} bytes; maximum is ${MAX_DIAGNOSTIC_PAYLOAD_BYTES}`));
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
