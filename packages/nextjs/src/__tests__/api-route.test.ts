import { Oluso } from '../client';
import { withOlusoApiRoute } from '../api-route';

function makeReq() {
  return { method: 'POST', url: '/api/widgets', query: {}, headers: {}, body: { name: 'widget' } } as any;
}

function makeRes(statusCode = 200) {
  const res: any = { statusCode };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
}

describe('withOlusoApiRoute', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
  });

  it('does not report on a successful response', async () => {
    const oluso = new Oluso({ apiKey: 'test-api-key', logToConsole: false });
    const handler = withOlusoApiRoute(oluso, async (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await handler(makeReq(), makeRes());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports and rethrows when the handler throws', async () => {
    const oluso = new Oluso({ apiKey: 'test-api-key', enableOfflineQueue: false, logToConsole: false });
    const handler = withOlusoApiRoute(oluso, async () => {
      throw new Error('handler blew up');
    });

    await expect(handler(makeReq(), makeRes())).rejects.toThrow('handler blew up');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.message).toBe('handler blew up');
    expect(body.context.custom.request.body).toEqual({ name: 'widget' });
  });

  it('reports a synthetic error when res.statusCode ends up >= 500', async () => {
    const oluso = new Oluso({ apiKey: 'test-api-key', enableOfflineQueue: false, logToConsole: false });
    const handler = withOlusoApiRoute(oluso, async (_req, res) => {
      res.status(500).json({ error: 'nope' });
    });

    await handler(makeReq(), makeRes());

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.message).toContain('500');
  });
});
