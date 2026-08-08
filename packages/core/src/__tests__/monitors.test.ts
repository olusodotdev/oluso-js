import { MonitorClient, MonitorRequestError } from '../monitors';

const response = (status = 202, body: Record<string, unknown> = { accepted: true }) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);

describe('MonitorClient', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('sends redacted assertion evidence with project authentication', async () => {
    const fetchMock = jest.fn(() => response());
    global.fetch = fetchMock as typeof fetch;
    const client = new MonitorClient({ apiKey: 'project-key', endpoint: 'https://example.test/monitors/events', retries: 0 });

    await client.assertOutcome({
      monitorId: 'monitor-1', passed: false, expected: 'settled', actual: 'pending',
      context: { payment_id: 'pay-1', authorization: 'Bearer secret' },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect((init!.headers as Record<string, string>)['x-oluso-signature']).toBe('project-key');
    const body = JSON.parse(String(init!.body));
    expect(body.monitor_id).toBe('monitor-1');
    expect(body.context.authorization).toBe('[REDACTED]');
    expect(body.kind).toBe('wrong');
    expect(typeof body.timestamp).toBe('number');
  });

  it('uses the dedicated heartbeat URL without exposing the project key', async () => {
    const fetchMock = jest.fn(() => response());
    global.fetch = fetchMock as typeof fetch;
    const client = new MonitorClient({ apiKey: 'project-key', retries: 0 });
    await client.heartbeat('https://api.oluso.dev/api/v1/monitors/heartbeat/secret-url', {
      context: { backup_id: 'backup-1' },
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/heartbeat/');
    expect((fetchMock.mock.calls[0][1]!.headers as Record<string, string>)['x-oluso-signature']).toBeUndefined();
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]!.body));
    expect(body.evidence).toEqual({ backup_id: 'backup-1' });
    expect(typeof body.timestamp).toBe('number');
  });

  it('generates a workflow run ID when the caller omits one', async () => {
    const fetchMock = jest.fn(() => response());
    global.fetch = fetchMock as typeof fetch;
    const workflow = new MonitorClient({ apiKey: 'key', endpoint: 'https://example.test/events', retries: 0 })
      .workflow({ monitor: 'deployment' });
    await workflow.checkpoint('queued');
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]!.body));
    expect(body.run_id).toEqual(expect.any(String));
    expect(body.run_id.length).toBeGreaterThan(8);
    expect(body.timestamp).toEqual(expect.any(Number));
  });

  it('tracks checkpoints and supports context-only completion', async () => {
    const fetchMock = jest.fn(() => response());
    global.fetch = fetchMock as typeof fetch;
    const workflow = new MonitorClient({ apiKey: 'key', endpoint: 'https://example.test/events', retries: 0 })
      .workflow({ monitor: 'deployment' }, 'deploy-7');
    await workflow.checkpoint('building');
    await workflow.complete({ deployment_id: 'deploy-7' });
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]!.body));
    expect(body).toMatchObject({ monitor: 'deployment', run_id: 'deploy-7', state: 'building', status: 'completed' });
  });

  it('retries transient responses but not validation errors', async () => {
    const fetchMock = jest.fn()
      .mockImplementationOnce(() => response(503, { error: 'busy' }))
      .mockImplementationOnce(() => response());
    global.fetch = fetchMock as typeof fetch;
    await new MonitorClient({ apiKey: 'key', retries: 1 }).assertOutcome({ monitor: 'payment', passed: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    global.fetch = jest.fn(() => response(400, { error: 'bad monitor' })) as typeof fetch;
    await expect(new MonitorClient({ apiKey: 'key' }).assertOutcome({ monitor: 'payment', passed: true }))
      .rejects.toEqual(expect.objectContaining<Partial<MonitorRequestError>>({ status: 400, retryable: false }));
  });
});
