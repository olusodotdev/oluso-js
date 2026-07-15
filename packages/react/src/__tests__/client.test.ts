import { OlusoClient } from '../client';

describe('OlusoClient', () => {
    beforeEach(() => {
        window.localStorage.clear();
        (global.fetch as jest.Mock | undefined)?.mockClear?.();
    });

    it('sends a captured exception via fetch to the configured endpoint', async () => {
        const fetchMock = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchMock as any;

        const client = new OlusoClient({
            apiKey: 'test-api-key',
            endpoint: 'https://example.test/api/v1/error/report',
            enableOfflineQueue: false,
        });

        await client.captureException(new Error('Test error'));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('https://example.test/api/v1/error/report');

        const body = JSON.parse(options.body);
        expect(body.message).toBe('Test error');
        expect(options.headers['x-oluso-signature']).toBe('test-api-key');
    });

    it('queues the report to localStorage when the send fails', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

        const client = new OlusoClient({
            apiKey: 'test-api-key',
            endpoint: 'https://example.test/api/v1/error/report',
        });

        await client.captureException(new Error('Test error'));

        const stored = JSON.parse(window.localStorage.getItem('oluso-queue') || '[]');
        expect(stored).toHaveLength(1);
        expect(stored[0].report.message).toBe('Test error');
    });

    it('adds breadcrumbs that are attached to subsequent reports', async () => {
        const fetchMock = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchMock as any;

        const client = new OlusoClient({
            apiKey: 'test-api-key',
            enableOfflineQueue: false,
        });

        client.addBreadcrumb({ message: 'User clicked checkout', level: 'info' });
        await client.captureException(new Error('Checkout failed'));

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.context.breadcrumbs).toHaveLength(1);
        expect(body.context.breadcrumbs[0].message).toBe('User clicked checkout');
    });
});
