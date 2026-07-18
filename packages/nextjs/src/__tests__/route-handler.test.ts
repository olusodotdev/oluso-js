/**
 * @jest-environment node
 */
import { Oluso } from '../client';
import { withOluso } from '../route-handler';

describe('withOluso', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
  });

  it('passes through a successful response untouched', async () => {
    const oluso = new Oluso({ apiKey: 'test-api-key', logToConsole: false });
    const handler = withOluso(oluso, async () => new Response('ok', { status: 200 }));

    const res = await handler(new Request('https://example.test/api/widgets'), {});
    expect(res.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports and rethrows when the handler throws', async () => {
    const oluso = new Oluso({ apiKey: 'test-api-key', enableOfflineQueue: false, logToConsole: false });
    const handler = withOluso(oluso, async () => {
      throw new Error('handler blew up');
    });

    await expect(handler(new Request('https://example.test/api/widgets'), {})).rejects.toThrow('handler blew up');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.message).toBe('handler blew up');
    expect(body.severity).toBe('critical');
    expect(body.context.custom.request.url).toBe('/api/widgets');
  });

  it('reports a synthetic error when the response is a 5xx', async () => {
    const oluso = new Oluso({ apiKey: 'test-api-key', enableOfflineQueue: false, logToConsole: false });
    const handler = withOluso(oluso, async () => new Response('nope', { status: 503 }));

    const res = await handler(new Request('https://example.test/api/widgets'), {});
    expect(res.status).toBe(503);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.message).toContain('503');
  });
});
