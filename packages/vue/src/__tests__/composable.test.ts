import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { OlusoClient } from '@oluso/browser';
import { OlusoVuePlugin } from '../plugin';
import { useOluso } from '../composable';

describe('useOluso', () => {
    beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
    });

    it('returns the client installed by OlusoVuePlugin', () => {
        let injected: OlusoClient | undefined;

        const Consumer = defineComponent({
            setup() {
                injected = useOluso();
                return () => null;
            },
        });

        mount(Consumer, {
            global: {
                plugins: [[OlusoVuePlugin, { apiKey: 'test-api-key', enableOfflineQueue: false }]],
            },
        });

        expect(injected).toBeInstanceOf(OlusoClient);
    });

    it('throws a helpful error when the plugin is not installed', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        let thrown: Error | undefined;

        const Consumer = defineComponent({
            setup() {
                try {
                    useOluso();
                } catch (err) {
                    thrown = err as Error;
                }
                return () => null;
            },
        });

        mount(Consumer);
        warnSpy.mockRestore();

        expect(thrown?.message).toMatch(/OlusoVuePlugin/);
    });
});
