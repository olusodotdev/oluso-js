import { Sanitizer } from '../sanitizer';

describe('Sanitizer.sanitizeObject', () => {
    const sanitizer = new Sanitizer();

    it('does not throw on null-prototype objects (regression: value.hasOwnProperty is not a function)', () => {
        // Object.create(null) has no prototype chain, so it has no
        // .hasOwnProperty method. This is what crashed reportError inside a
        // customer app -- an ORM row / parsed object reached the sanitizer.
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
        const result = sanitizer.sanitizeObject(evil);
        expect(result.name).toBe('ok');
    });

    it('redacts sensitive keys and preserves the rest', () => {
        const result = sanitizer.sanitizeObject({
            email: 'a@b.com',
            token: 'abc123',
            nested: { apiKey: 'secret', keep: 1 },
        });

        expect(result.email).toBe('a@b.com');
        expect(result.token).toBe('[REDACTED]');
        expect(result.nested.apiKey).toBe('[REDACTED]');
        expect(result.nested.keep).toBe(1);
    });
});

describe('Sanitizer.sanitizeHeaders', () => {
    const sanitizer = new Sanitizer();

    it('does not throw on a null-prototype headers object', () => {
        const headers = Object.create(null);
        headers['authorization'] = 'Bearer xyz';
        headers['x-request-id'] = 'req-1';

        const result = sanitizer.sanitizeHeaders(headers);

        expect(result['authorization']).toBe('[REDACTED]');
        expect(result['x-request-id']).toBe('req-1');
    });
});
