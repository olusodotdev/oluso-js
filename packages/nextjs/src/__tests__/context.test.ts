import { NextjsContextManager } from '../context';

describe('NextjsContextManager', () => {
  it('isolates breadcrumbs between concurrent run() calls', async () => {
    const manager = new NextjsContextManager();
    const results: Record<string, string[]> = {};

    await Promise.all([
      manager.run(async () => {
        manager.addBreadcrumb({ message: 'a1', level: 'info' });
        await new Promise((resolve) => setTimeout(resolve, 10));
        manager.addBreadcrumb({ message: 'a2', level: 'info' });
        results.a = manager.getContext().breadcrumbs!.map((b) => b.message);
      }),
      manager.run(async () => {
        manager.addBreadcrumb({ message: 'b1', level: 'info' });
        results.b = manager.getContext().breadcrumbs!.map((b) => b.message);
      }),
    ]);

    expect(results.a).toEqual(['a1', 'a2']);
    expect(results.b).toEqual(['b1']);
  });

  it('falls back to a shared store outside run()', () => {
    const manager = new NextjsContextManager();
    manager.addBreadcrumb({ message: 'no request scope', level: 'info' });
    expect(manager.getContext().breadcrumbs!.map((b) => b.message)).toEqual(['no request scope']);
  });

  it('caps breadcrumbs at maxBreadcrumbs', () => {
    const manager = new NextjsContextManager(2);
    manager.addBreadcrumb({ message: '1', level: 'info' });
    manager.addBreadcrumb({ message: '2', level: 'info' });
    manager.addBreadcrumb({ message: '3', level: 'info' });
    expect(manager.getContext().breadcrumbs!.map((b) => b.message)).toEqual(['2', '3']);
  });

  it('tracks user and custom context per-run', () => {
    const manager = new NextjsContextManager();
    manager.run(() => {
      manager.setUserContext({ id: 'user_1' });
      manager.setCustomContext('cartId', 'cart_1');
      const ctx = manager.getContext();
      expect(ctx.user).toEqual({ id: 'user_1' });
      expect(ctx.custom).toEqual({ cartId: 'cart_1' });
    });
  });
});
