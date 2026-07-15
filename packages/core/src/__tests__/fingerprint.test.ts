import { generateFingerprint } from '../fingerprint';

describe('generateFingerprint', () => {
    it('produces the same fingerprint for errors that only differ by dynamic values', () => {
        const a = new TypeError('User 123 not found');
        const b = new TypeError('User 456 not found');

        expect(generateFingerprint(a)).toBe(generateFingerprint(b));
    });

    it('produces different fingerprints for different error types', () => {
        const a = new TypeError('boom');
        const b = new RangeError('boom');

        expect(generateFingerprint(a)).not.toBe(generateFingerprint(b));
    });

    it('returns a stable 8-character hex string', () => {
        const fp = generateFingerprint(new Error('boom'));
        expect(fp).toMatch(/^[0-9a-f]{8}$/);
    });
});
