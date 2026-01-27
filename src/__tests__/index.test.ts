import { Cryer } from '../index';
import * as httpsUtils from '../utils/https';

jest.mock('../utils/https');

describe('Cryer', () => {
    let cryer: Cryer;
    const mockSendErrorReport = httpsUtils.sendErrorReport as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        cryer = new Cryer({
            apiKey: 'test-api-key',
            logToConsole: false,
        });
        mockSendErrorReport.mockResolvedValue(undefined);
    });

    it('should report an error', async () => {
        const error = new Error('Test error');
        await cryer.reportError(error);

        expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
        const [url, report, options] = mockSendErrorReport.mock.calls[0];

        expect(url).toBe('https://crier-test.onrender.com/api/v1/error/report');
        expect(report.message).toBe('Test error');
        expect(options.apiKey).toBe('test-api-key');
    });

    it('should add breadcrumbs', async () => {
        await cryer.getContextManager().run(async () => {
            cryer.addBreadcrumb({
                message: 'User clicked button',
                level: 'info',
                category: 'ui',
            });

            const error = new Error('State error');
            await cryer.reportError(error);

            expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
            const report = mockSendErrorReport.mock.calls[0][1];

            expect(report.context.breadcrumbs).toBeDefined();
            expect(report.context.breadcrumbs).toHaveLength(1);
            expect(report.context.breadcrumbs[0].message).toBe('User clicked button');
        });
    });

    it('should respect shouldReport filter', async () => {
        const cryerWithFilter = new Cryer({
            apiKey: 'test-api-key',
            logToConsole: false,
            shouldReport: (err) => err.message !== 'Ignore me',
        });

        await cryerWithFilter.reportError(new Error('Ignore me'));
        expect(mockSendErrorReport).not.toHaveBeenCalled();

        await cryerWithFilter.reportError(new Error('Report me'));
        expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
    });

    it('should generate fingerprint for deduplication', async () => {
        const error1 = new Error('Error A');
        const error2 = new Error('Error A');

        await cryer.reportError(error1);
        await cryer.reportError(error2);

        const fingerprint1 = mockSendErrorReport.mock.calls[0][1].fingerprint;
        const fingerprint2 = mockSendErrorReport.mock.calls[1][1].fingerprint;

        expect(fingerprint1).toBe(fingerprint2);
        expect(fingerprint1).toBeDefined();
    });
});
