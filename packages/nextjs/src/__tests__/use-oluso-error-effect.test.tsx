import { render } from '@testing-library/react';
import { OlusoProvider } from '@oluso/react';
import { useOlusoErrorEffect } from '../use-oluso-error-effect';

function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  useOlusoErrorEffect(error);
  return <div>something went wrong</div>;
}

describe('useOlusoErrorEffect', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
  });

  it('reports the error exactly once, including its digest', () => {
    const error = Object.assign(new Error('render blew up'), { digest: 'abc123' });

    const { rerender } = render(
      <OlusoProvider options={{ apiKey: 'test-api-key', enableOfflineQueue: false }}>
        <ErrorPage error={error} />
      </OlusoProvider>
    );

    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.message).toBe('render blew up');
    expect(body.context.custom.digest).toBe('abc123');

    (global.fetch as jest.Mock).mockClear();
    rerender(
      <OlusoProvider options={{ apiKey: 'test-api-key', enableOfflineQueue: false }}>
        <ErrorPage error={error} />
      </OlusoProvider>
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
