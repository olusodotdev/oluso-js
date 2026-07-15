import { ErrorReport } from '@oluso/core';

interface SendOptions {
  apiKey: string;
  timeout?: number;
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
    body: JSON.stringify(errorReport),
    signal: controller?.signal,
  })
    .then((res) => {
      if (!res.ok) {
        console.error(`[Oluso] Error reporting failed with status ${res.status}`);
        throw new Error(`Oluso reporting failed with status ${res.status}`);
      }
    })
    .catch((err) => {
      console.error('[Oluso] Failed to send error report:', err?.message || err);
      throw err;
    })
    .finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
}
