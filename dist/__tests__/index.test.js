"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const httpsUtils = __importStar(require("../utils/https"));
jest.mock('../utils/https');
describe('Oluso', () => {
    let oluso;
    const mockSendErrorReport = httpsUtils.sendErrorReport;
    beforeEach(() => {
        jest.clearAllMocks();
        oluso = new index_1.Oluso({
            apiKey: 'test-api-key',
            logToConsole: false,
        });
        mockSendErrorReport.mockResolvedValue(undefined);
    });
    it('should report an error', async () => {
        const error = new Error('Test error');
        await oluso.reportError(error);
        expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
        const [url, report, options] = mockSendErrorReport.mock.calls[0];
        expect(url).toBe('https://crier-test.onrender.com/api/v1/error/report');
        expect(report.message).toBe('Test error');
        expect(options.apiKey).toBe('test-api-key');
    });
    it('should add breadcrumbs', async () => {
        await oluso.getContextManager().run(async () => {
            oluso.addBreadcrumb({
                message: 'User clicked button',
                level: 'info',
                category: 'ui',
            });
            const error = new Error('State error');
            await oluso.reportError(error);
            expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
            const report = mockSendErrorReport.mock.calls[0][1];
            expect(report.context.breadcrumbs).toBeDefined();
            expect(report.context.breadcrumbs).toHaveLength(1);
            expect(report.context.breadcrumbs[0].message).toBe('User clicked button');
        });
    });
    it('should respect shouldReport filter', async () => {
        const olusoWithFilter = new index_1.Oluso({
            apiKey: 'test-api-key',
            logToConsole: false,
            shouldReport: (err) => err.message !== 'Ignore me',
        });
        await olusoWithFilter.reportError(new Error('Ignore me'));
        expect(mockSendErrorReport).not.toHaveBeenCalled();
        await olusoWithFilter.reportError(new Error('Report me'));
        expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
    });
    it('should generate fingerprint for deduplication', async () => {
        const error1 = new Error('Error A');
        const error2 = new Error('Error A');
        await oluso.reportError(error1);
        await oluso.reportError(error2);
        const fingerprint1 = mockSendErrorReport.mock.calls[0][1].fingerprint;
        const fingerprint2 = mockSendErrorReport.mock.calls[1][1].fingerprint;
        expect(fingerprint1).toBe(fingerprint2);
        expect(fingerprint1).toBeDefined();
    });
});
