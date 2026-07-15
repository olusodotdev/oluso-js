import { ErrorHandler, Injector } from '@angular/core';
import { provideOluso } from '../provide-oluso';

describe('OlusoErrorHandler', () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchMock as any;
    });

    it('reports errors Angular routes through ErrorHandler.handleError', async () => {
        const injector = Injector.create({
            providers: [provideOluso({ apiKey: 'test-api-key', enableOfflineQueue: false })],
        });

        const handler = injector.get(ErrorHandler);
        handler.handleError(new Error('template blew up'));

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.message).toBe('template blew up');
    });

    it('normalizes non-Error values Angular sometimes passes through', async () => {
        const injector = Injector.create({
            providers: [provideOluso({ apiKey: 'test-api-key', enableOfflineQueue: false })],
        });

        const handler = injector.get(ErrorHandler);
        handler.handleError('a raw string was thrown');

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.message).toBe('a raw string was thrown');
    });
});
