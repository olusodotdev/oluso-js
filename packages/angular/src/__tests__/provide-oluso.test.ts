import { ErrorHandler, Injector } from '@angular/core';
import { OlusoClient } from '@oluso/browser';
import { provideOluso } from '../provide-oluso';
import { OLUSO_CLIENT } from '../tokens';

describe('provideOluso', () => {
    beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
    });

    it('registers an OlusoClient reachable via OLUSO_CLIENT', () => {
        const injector = Injector.create({
            providers: [provideOluso({ apiKey: 'test-api-key', enableOfflineQueue: false })],
        });

        expect(injector.get(OLUSO_CLIENT)).toBeInstanceOf(OlusoClient);
    });

    it('replaces Angular\'s ErrorHandler with OlusoErrorHandler', () => {
        const injector = Injector.create({
            providers: [provideOluso({ apiKey: 'test-api-key', enableOfflineQueue: false })],
        });

        const handler = injector.get(ErrorHandler);
        expect(handler.constructor.name).toBe('OlusoErrorHandler');
    });
});
