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
            logToConsole: false,
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
            logToConsole: false,
        });

        await client.captureException(new Error('Test error'));

        const stored = JSON.parse(window.localStorage.getItem('oluso-queue') || '[]');
        expect(stored).toHaveLength(1);
        expect(stored[0].report.message).toBe('Test error');
    });

    it('scopes captureException customContext to that single report', async () => {
        const fetchMock = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchMock as any;

        const client = new OlusoClient({
            apiKey: 'test-api-key',
            enableOfflineQueue: false,
            logToConsole: false,
        });

        await client.captureException(new Error('first'), { orderId: 'order_42' });
        await client.captureException(new Error('second'));

        const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
        expect(firstBody.context.custom.orderId).toBe('order_42');
        expect(secondBody.context.custom.orderId).toBeUndefined();
    });

    it('retries an oversized report with context stripped instead of queueing it', async () => {
        const fetchMock = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchMock as any;

        const client = new OlusoClient({
            apiKey: 'test-api-key',
            logToConsole: false,
        });

        await client.captureException(new Error('big context'), {
            blob: 'x'.repeat(600 * 1024),
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.message).toBe('big context');
        expect(body.context).toEqual({});

        const stored = JSON.parse(window.localStorage.getItem('oluso-queue') || '[]');
        expect(stored).toHaveLength(0);
    });

    it('drops a report that stays oversized even without context', async () => {
        const fetchMock = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchMock as any;

        const client = new OlusoClient({
            apiKey: 'test-api-key',
            logToConsole: false,
        });

        await client.captureException(new Error('y'.repeat(600 * 1024)));

        expect(fetchMock).not.toHaveBeenCalled();
        const stored = JSON.parse(window.localStorage.getItem('oluso-queue') || '[]');
        expect(stored).toHaveLength(0);
    });

    it('falls back to the constructor name as title for empty messages', async () => {
        const fetchMock = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchMock as any;

        const client = new OlusoClient({
            apiKey: 'test-api-key',
            enableOfflineQueue: false,
            logToConsole: false,
        });

        await client.captureException(new TypeError(''));

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.title).toBe('TypeError');
    });

    it('flushes the offline queue when connectivity returns', async () => {
        const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
        global.fetch = fetchMock as any;

        const client = new OlusoClient({
            apiKey: 'test-api-key',
            logToConsole: false,
        });

        await client.captureException(new Error('offline error retry'));
        expect(JSON.parse(window.localStorage.getItem('oluso-queue') || '[]')).toHaveLength(1);

        fetchMock.mockResolvedValue({ ok: true });
        window.dispatchEvent(new Event('online'));
        for (let i = 0; i < 3; i++) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        const retried = fetchMock.mock.calls.filter(
            ([, options]) => JSON.parse(options.body).message === 'offline error retry'
        );
        expect(retried.length).toBeGreaterThanOrEqual(2);
        expect(JSON.parse(window.localStorage.getItem('oluso-queue') || '[]')).toHaveLength(0);
    });

    it('adds breadcrumbs that are attached to subsequent reports', async () => {
        const fetchMock = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchMock as any;

        const client = new OlusoClient({
            apiKey: 'test-api-key',
            enableOfflineQueue: false,
            logToConsole: false,
        });

        client.addBreadcrumb({ message: 'User clicked checkout', level: 'info' });
        await client.captureException(new Error('Checkout failed'));

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.context.breadcrumbs).toHaveLength(1);
        expect(body.context.breadcrumbs[0].message).toBe('User clicked checkout');
    });
});
