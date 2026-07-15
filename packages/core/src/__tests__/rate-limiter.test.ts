import { RateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
    it('allows sends under the limit', () => {
        const limiter = new RateLimiter(3);
        expect(limiter.canSend()).toBe(true);
        expect(limiter.canSend()).toBe(true);
        expect(limiter.canSend()).toBe(true);
        expect(limiter.getCount()).toBe(3);
    });

    it('blocks sends once the limit is reached', () => {
        const limiter = new RateLimiter(2);
        expect(limiter.canSend()).toBe(true);
        expect(limiter.canSend()).toBe(true);
        expect(limiter.canSend()).toBe(false);
        expect(limiter.getCount()).toBe(2);
    });

    it('lets sends through again after old timestamps age out', () => {
        const limiter = new RateLimiter(1);
        const nowSpy = jest.spyOn(Date, 'now');

        nowSpy.mockReturnValue(0);
        expect(limiter.canSend()).toBe(true);
        expect(limiter.canSend()).toBe(false);

        nowSpy.mockReturnValue(60_001);
        expect(limiter.canSend()).toBe(true);

        nowSpy.mockRestore();
    });

    it('reset clears tracked timestamps', () => {
        const limiter = new RateLimiter(1);
        expect(limiter.canSend()).toBe(true);
        expect(limiter.canSend()).toBe(false);

        limiter.reset();
        expect(limiter.canSend()).toBe(true);
    });
});
