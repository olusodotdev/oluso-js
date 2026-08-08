import https from 'https';
import http from 'http';
import { URL } from 'url';
import { ErrorReport } from '../types';

interface SendOptions {
  apiKey: string;
  timeout?: number;
}

export const MAX_DIAGNOSTIC_PAYLOAD_BYTES = 512 * 1024;

export function sendErrorReport(
  reportUrl: string, 
  errorReport: ErrorReport, 
  options: SendOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(reportUrl);
      const data = JSON.stringify(errorReport);
      const payloadBytes = Buffer.byteLength(data);
      if (payloadBytes > MAX_DIAGNOSTIC_PAYLOAD_BYTES) {
        reject(new Error(`Oluso report payload is ${payloadBytes} bytes; maximum is ${MAX_DIAGNOSTIC_PAYLOAD_BYTES}`));
        return;
      }
      
      const requestOptions = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payloadBytes,
          'x-oluso-signature': options.apiKey
        },
        timeout: options.timeout || 5000
      };
      
      const requestFn = url.protocol === 'https:' ? https.request : http.request;
      
      const req = requestFn(requestOptions, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            console.log('[Oluso] Error report sent successfully');
            resolve();
          } else {
            console.error(`[Oluso] Error reporting failed with status ${res.statusCode}: ${responseData}`);
            reject(new Error(`Oluso reporting failed with status ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', (err) => {
        console.error('[Oluso] Failed to send error report:', err.message);
        reject(err);
      });
      
      req.on('timeout', () => {
        req.destroy();
        console.error('[Oluso] Timeout when sending error report');
        reject(new Error('Oluso reporting timed out'));
      });
      
      req.write(data);
      req.end();
    } catch (err) {
      console.error('[Oluso] Exception when sending error report:', err);
      reject(err);
    }
  });
}
