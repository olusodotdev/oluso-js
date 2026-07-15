import { Injector, runInInjectionContext } from '@angular/core';
import { OlusoClient } from '@oluso/browser';
import { provideOluso } from '../provide-oluso';
import { injectOluso } from '../inject-oluso';

describe('injectOluso', () => {
    beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
    });

    it('returns the client registered by provideOluso', () => {
        const injector = Injector.create({
            providers: [provideOluso({ apiKey: 'test-api-key', enableOfflineQueue: false })],
        });

        const client = runInInjectionContext(injector, () => injectOluso());

        expect(client).toBeInstanceOf(OlusoClient);
    });

    it('throws outside an injection context, same as Angular\'s own inject()', () => {
        expect(() => injectOluso()).toThrow();
    });
});
