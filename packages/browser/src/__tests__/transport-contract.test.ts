import { MAX_DIAGNOSTIC_PAYLOAD_BYTES, PayloadTooLargeError, sendErrorReport } from '../transport';

describe('diagnostic transport contract', () => {
  it('rejects a payload over 512 KiB with PayloadTooLargeError before calling fetch', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    const send = sendErrorReport('https://example.test/report', {
      title: 'oversized',
      message: 'x'.repeat(MAX_DIAGNOSTIC_PAYLOAD_BYTES + 1),
    }, { apiKey: 'test', logToConsole: false });
    await expect(send).rejects.toThrow('maximum');
    await expect(send).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends small payloads with keepalive so unload-time flushes survive', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as any;
    await sendErrorReport('https://example.test/report', {
      title: 'small',
      message: 'boom',
    }, { apiKey: 'test', logToConsole: false });
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
  });
});
