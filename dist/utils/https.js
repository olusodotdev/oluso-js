"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendErrorReport = sendErrorReport;
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
function sendErrorReport(reportUrl, errorReport, options) {
    return new Promise((resolve, reject) => {
        try {
            const url = new url_1.URL(reportUrl);
            const data = JSON.stringify(errorReport);
            const requestOptions = {
                method: 'POST',
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                    'x-cryer-signature': options.apiKey
                },
                timeout: options.timeout || 5000
            };
            const requestFn = url.protocol === 'https:' ? https_1.default.request : http_1.default.request;
            const req = requestFn(requestOptions, (res) => {
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve();
                    }
                    else {
                        console.error(`[Cryer] Error reporting failed with status ${res.statusCode}: ${responseData}`);
                        resolve(); // Don't reject as we don't want error reporting failures to break the app
                    }
                });
            });
            req.on('error', (err) => {
                console.error('[Cryer] Failed to send error report:', err.message);
                resolve();
            });
            req.on('timeout', () => {
                req.destroy();
                console.error('[Cryer] Timeout when sending error report');
                resolve();
            });
            req.write(data);
            req.end();
        }
        catch (err) {
            console.error('[Cryer] Exception when sending error report:', err);
            resolve();
        }
    });
}
