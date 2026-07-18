import { Oluso } from '../client';
import { createOnRequestError, registerOlusoProcessHandlers } from '../instrumentation';

describe('registerOlusoProcessHandlers', () => {
  const originalRuntime = process.env.NEXT_RUNTIME;

  afterEach(() => {
    if (originalRuntime === undefined) {
      delete process.env.NEXT_RUNTIME;
    } else {
      process.env.NEXT_RUNTIME = originalRuntime;
    }
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  it('registers process handlers on the nodejs runtime', () => {
    delete process.env.NEXT_RUNTIME;
    const oluso = new Oluso({ apiKey: 'test-api-key', logToConsole: false });
    const before = process.listenerCount('uncaughtException');

    registerOlusoProcessHandlers(oluso);

    expect(process.listenerCount('uncaughtException')).toBe(before + 1);
  });

  it('does nothing on the edge runtime', () => {
    process.env.NEXT_RUNTIME = 'edge';
    const oluso = new Oluso({ apiKey: 'test-api-key', logToConsole: false });
    const before = process.listenerCount('uncaughtException');

    registerOlusoProcessHandlers(oluso);

    expect(process.listenerCount('uncaughtException')).toBe(before);
  });
});

describe('createOnRequestError', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
  });

  it('reports the error with request info attached', async () => {
    const oluso = new Oluso({ apiKey: 'test-api-key', enableOfflineQueue: false, logToConsole: false });
    const onRequestError = createOnRequestError(oluso);

    await onRequestError(
      new Error('render blew up'),
      { path: '/dashboard', method: 'GET', headers: { cookie: 'secret' } },
      { routerKind: 'App Router', routePath: '/dashboard', routeType: 'render' }
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.message).toBe('render blew up');
    expect(body.severity).toBe('critical');
    expect(body.context.custom.request.url).toBe('/dashboard');
    expect(body.context.custom.request.headers.cookie).toBe('[REDACTED]');
  });

  it('wraps a non-Error thrown value', async () => {
    const oluso = new Oluso({ apiKey: 'test-api-key', enableOfflineQueue: false, logToConsole: false });
    const onRequestError = createOnRequestError(oluso);

    await onRequestError('a string was thrown', { path: '/', method: 'GET', headers: {} }, { routeType: 'route' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.message).toBe('a string was thrown');
    expect(body.context.custom.request.routeType).toBe('route-handler');
  });
});
