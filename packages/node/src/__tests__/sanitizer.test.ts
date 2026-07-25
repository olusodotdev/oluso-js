import { Sanitizer } from '../utils/sanitizer';

describe('Sanitizer.sanitizeObject (node)', () => {
    const sanitizer = new Sanitizer();

    it('does not throw on null-prototype objects (regression: value.hasOwnProperty is not a function)', () => {
        // The exact crash seen in production: an Object.create(null) value
        // reached sanitize() inside reportError, and value.hasOwnProperty
        // threw because null-prototype objects have no such method.
        const nullProto = Object.create(null);
        nullProto.userId = 42;
        nullProto.password = 'hunter2';

        const result = sanitizer.sanitizeObject({ user: nullProto });

        expect(result.user.userId).toBe(42);
        expect(result.user.password).toBe('[REDACTED]');
    });

    it('does not throw when a payload carries its own hasOwnProperty key', () => {
        const evil = JSON.parse('{"hasOwnProperty": "not a function", "name": "ok"}');

        expect(() => sanitizer.sanitizeObject(evil)).not.toThrow();
    });

    it('does not throw on a null-prototype headers object', () => {
        const headers = Object.create(null);
        headers['authorization'] = 'Bearer xyz';
        headers['x-request-id'] = 'req-1';

        const result = sanitizer.sanitizeHeaders(headers);

        expect(result['authorization']).toBe('[REDACTED]');
        expect(result['x-request-id']).toBe('req-1');
    });
});
