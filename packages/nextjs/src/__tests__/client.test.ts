import { Oluso } from '../client';

describe('Oluso (nextjs)', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock | undefined)?.mockClear?.();
  });

  it('sends a captured exception via fetch to the configured endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as any;

    const oluso = new Oluso({
      apiKey: 'test-api-key',
      endpoint: 'https://example.test/api/v1/error/report',
      enableOfflineQueue: false,
      logToConsole: false,
    });

    await oluso.captureException(new Error('Test error'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.test/api/v1/error/report');

    const body = JSON.parse(options.body);
    expect(body.message).toBe('Test error');
    expect(options.headers['x-oluso-signature']).toBe('test-api-key');
    expect(body.context.custom.server.runtime).toBe('nodejs');
  });

  it('queues the report in memory when the send fails, and flushes it later', async () => {
    const fetchMock = jest.fn().mockRejectedValueOnce(new Error('network down')).mockResolvedValue({ ok: true });
    global.fetch = fetchMock as any;

    const oluso = new Oluso({ apiKey: 'test-api-key', logToConsole: false });

    await oluso.captureException(new Error('first'));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await oluso.flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.message).toBe('first');
  });

  it('scopes breadcrumbs to the current runInContext() call and does not leak across concurrent requests', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as any;

    const oluso = new Oluso({ apiKey: 'test-api-key', enableOfflineQueue: false, logToConsole: false });

    await Promise.all([
      oluso.runInContext(async () => {
        oluso.addBreadcrumb({ message: 'request A', level: 'info' });
        await new Promise((resolve) => setTimeout(resolve, 10));
        await oluso.captureException(new Error('error A'));
      }),
      oluso.runInContext(async () => {
        oluso.addBreadcrumb({ message: 'request B', level: 'info' });
        await oluso.captureException(new Error('error B'));
      }),
    ]);

    const reports = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body));
    const reportA = reports.find((r) => r.message === 'error A');
    const reportB = reports.find((r) => r.message === 'error B');

    expect(reportA.context.breadcrumbs.map((b: any) => b.message)).toEqual(['request A']);
    expect(reportB.context.breadcrumbs.map((b: any) => b.message)).toEqual(['request B']);
  });

  it('attaches sanitized request info when reportError is given a RequestContext', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as any;

    const oluso = new Oluso({ apiKey: 'test-api-key', enableOfflineQueue: false, logToConsole: false });

    await oluso.reportError(new Error('boom'), {
      url: '/api/widgets',
      method: 'POST',
      headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.context.custom.request.url).toBe('/api/widgets');
    expect(body.context.custom.request.headers.authorization).toBe('[REDACTED]');
  });

  it('does not report when shouldReport returns false', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as any;

    const oluso = new Oluso({
      apiKey: 'test-api-key',
      logToConsole: false,
      shouldReport: (err) => !err.message.includes('ignore me'),
    });

    await oluso.captureException(new Error('ignore me'));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
