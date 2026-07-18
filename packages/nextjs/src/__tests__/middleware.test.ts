/**
 * @jest-environment node
 */
import { Oluso } from '../client';
import { withOlusoMiddleware } from '../middleware';

describe('withOlusoMiddleware', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
  });

  it('passes through the response untouched on success', async () => {
    const oluso = new Oluso({ apiKey: 'test-api-key', logToConsole: false });
    const middleware = withOlusoMiddleware(oluso, async () => undefined as any);

    const result = await middleware(new Request('https://example.test/dashboard') as any, {} as any);
    expect(result).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports and rethrows when the middleware throws', async () => {
    const oluso = new Oluso({ apiKey: 'test-api-key', enableOfflineQueue: false, logToConsole: false });
    const middleware = withOlusoMiddleware(oluso, async () => {
      throw new Error('middleware blew up');
    });

    await expect(
      middleware(new Request('https://example.test/dashboard') as any, {} as any)
    ).rejects.toThrow('middleware blew up');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.message).toBe('middleware blew up');
    expect(body.context.custom.request.url).toBe('/dashboard');
  });
});
