import { OlusoClient } from '../client';

describe('OlusoClient', () => {
    afterEach(() => {
        delete (global as any).ErrorUtils;
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

    it('queues a failed report in memory and resends it on the next flush', async () => {
        const fetchMock = jest
            .fn()
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValue({ ok: true });
        global.fetch = fetchMock as any;

        const client = new OlusoClient({ apiKey: 'test-api-key' });

        await client.captureException(new Error('Test error'));
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await client.flush();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const body = JSON.parse(fetchMock.mock.calls[1][1].body);
        expect(body.message).toBe('Test error');
    });

    it('registers a global ErrorUtils handler and preserves the previous one', () => {
        const previousHandler = jest.fn();
        const setGlobalHandler = jest.fn();
        (global as any).ErrorUtils = {
            setGlobalHandler,
            getGlobalHandler: () => previousHandler,
        };

        global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

        new OlusoClient({ apiKey: 'test-api-key', enableOfflineQueue: false });

        expect(setGlobalHandler).toHaveBeenCalledTimes(1);
        const registeredHandler = setGlobalHandler.mock.calls[0][0];

        const boom = new Error('fatal boom');
        registeredHandler(boom, true);

        expect(previousHandler).toHaveBeenCalledWith(boom, true);
    });

    it('does not throw when ErrorUtils is unavailable (e.g. outside the RN runtime)', () => {
        expect(() => new OlusoClient({ apiKey: 'test-api-key', enableOfflineQueue: false })).not.toThrow();
    });
});
