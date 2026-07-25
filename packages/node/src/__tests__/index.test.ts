import { Oluso } from '../index';
import * as httpsUtils from '../utils/https';

jest.mock('../utils/https');

describe('Oluso', () => {
    let oluso: Oluso;
    const mockSendErrorReport = httpsUtils.sendErrorReport as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        oluso = new Oluso({
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

        expect(url).toBe((oluso as any).reportUrl);
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
        const olusoWithFilter = new Oluso({
            apiKey: 'test-api-key',
            logToConsole: false,
            shouldReport: (err) => err.message !== 'Ignore me',
        });

        await olusoWithFilter.reportError(new Error('Ignore me'));
        expect(mockSendErrorReport).not.toHaveBeenCalled();

        await olusoWithFilter.reportError(new Error('Report me'));
        expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
    });

    // Simulates a NestJS HttpException: it exposes getStatus().
    class FakeHttpException extends Error {
        constructor(message: string, private status: number) {
            super(message);
        }
        getStatus() {
            return this.status;
        }
    }

    it('does NOT report 4xx errors captured off the HTTP path (e.g. a BadRequestException thrown in a cron job)', async () => {
        // The production case: a background job threw
        // `BadRequestException: Clock-in record must be approved...` and it was
        // reported via captureException with no res -- so the adapter's 4xx
        // gate never saw it. It must still be filtered here.
        await oluso.reportError(new FakeHttpException('Clock-in must be approved', 400));
        await oluso.captureException(new FakeHttpException('Not found', 404));

        const withNumericStatus = new Error('unauthorized') as any;
        withNumericStatus.statusCode = 401;
        await oluso.reportError(withNumericStatus);

        expect(mockSendErrorReport).not.toHaveBeenCalled();
    });

    it('DOES report 5xx and status-less errors (real faults) off the HTTP path', async () => {
        await oluso.reportError(new FakeHttpException('upstream down', 503));
        await oluso.reportError(new TypeError('cannot read property of undefined'));

        expect(mockSendErrorReport).toHaveBeenCalledTimes(2);
    });

    it('reports 4xx when reportClientErrors is enabled', async () => {
        const olusoOptIn = new Oluso({
            apiKey: 'test-api-key',
            logToConsole: false,
            reportClientErrors: true,
        });

        await olusoOptIn.reportError(new FakeHttpException('bad request', 400));
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
