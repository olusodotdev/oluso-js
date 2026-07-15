import { createApp, defineComponent } from 'vue';
import { OlusoVuePlugin } from '../plugin';

/**
 * Uses raw `createApp`/`app.mount` rather than `@vue/test-utils`'s `mount()`
 * helper: VTU's helper doesn't route an error thrown during a component's
 * initial `setup()` through `app.config.errorHandler` the same way plain
 * Vue does, which would make these tests exercise a testing-library quirk
 * rather than our plugin.
 */
describe('OlusoVuePlugin', () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchMock as any;
    });

    it('reports errors thrown by a component via app.config.errorHandler', async () => {
        const Boom = defineComponent({
            setup() {
                throw new Error('render blew up');
            },
            render() {
                return null;
            },
        });

        const app = createApp(Boom);
        app.use(OlusoVuePlugin, { apiKey: 'test-api-key', enableOfflineQueue: false });
        app.mount(document.createElement('div'));

        // captureException triggers an async fetch; flush microtasks/timers
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.message).toBe('render blew up');
    });

    it('preserves a previously-registered errorHandler', async () => {
        const previousHandler = jest.fn();
        const Boom = defineComponent({
            setup() {
                throw new Error('render blew up');
            },
            render() {
                return null;
            },
        });

        const app = createApp(Boom);
        app.config.errorHandler = previousHandler;
        app.use(OlusoVuePlugin, { apiKey: 'test-api-key', enableOfflineQueue: false });
        app.mount(document.createElement('div'));

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(previousHandler).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
