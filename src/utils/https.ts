import https from 'https';
import http from 'http';
import { URL } from 'url';
import { ErrorReport } from '../types';

interface SendOptions {
  apiKey: string;
  timeout?: number;
}

export function sendErrorReport(
  reportUrl: string, 
  errorReport: ErrorReport, 
  options: SendOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(reportUrl);
      const data = JSON.stringify(errorReport);
      
      const requestOptions = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
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
            resolve(); // Don't reject as we don't want error reporting failures to break the app
          }
        });
      });
      
      req.on('error', (err) => {
        console.error('[Oluso] Failed to send error report:', err.message);
        resolve();
      });
      
      req.on('timeout', () => {
        req.destroy();
        console.error('[Oluso] Timeout when sending error report');
        resolve();
      });
      
      req.write(data);
      req.end();
    } catch (err) {
      console.error('[Oluso] Exception when sending error report:', err);
      resolve();
    }
  });
}