import { MAX_DIAGNOSTIC_PAYLOAD_BYTES, sendErrorReport } from '../utils/https';

describe('diagnostic transport contract', () => {
  it('rejects a payload over 512 KiB before opening a request', async () => {
    await expect(sendErrorReport('https://example.test/report', {
      title: 'oversized',
      message: 'x'.repeat(MAX_DIAGNOSTIC_PAYLOAD_BYTES + 1),
    }, { apiKey: 'test' })).rejects.toThrow('maximum');
  });
});
