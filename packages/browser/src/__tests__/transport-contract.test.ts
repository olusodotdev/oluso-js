import { MAX_DIAGNOSTIC_PAYLOAD_BYTES, sendErrorReport } from '../transport';

describe('diagnostic transport contract', () => {
  it('rejects a payload over 512 KiB before calling fetch', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    await expect(sendErrorReport('https://example.test/report', {
      title: 'oversized',
      message: 'x'.repeat(MAX_DIAGNOSTIC_PAYLOAD_BYTES + 1),
    }, { apiKey: 'test', logToConsole: false })).rejects.toThrow('maximum');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
